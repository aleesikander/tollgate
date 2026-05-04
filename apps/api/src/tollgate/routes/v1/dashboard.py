"""Dashboard endpoints — JWT-authenticated, for the web UI."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from tollgate.dependencies import AuthenticatedUser, DBSession
from tollgate.models.action import Action, Decision
from tollgate.models.agent import Agent
from tollgate.services.approval import ApprovalError, ApprovalService
from tollgate.services.agent import AgentService

router = APIRouter()


# ---------- Schemas ----------

class AuditEntryResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    agent_name: str | None
    action_name: str
    decision: str
    payload: dict[str, Any]
    reason: str | None
    decided_by: str | None
    created_at: str
    decided_at: str | None


class AuditListResponse(BaseModel):
    items: list[AuditEntryResponse]
    total: int


class HourlyBucket(BaseModel):
    hour: str
    allowed: int
    denied: int
    pending: int


class StatsResponse(BaseModel):
    agent_count: int
    pending_count: int
    actions_today: int


class DashboardDecideRequest(BaseModel):
    decision: Literal["approved", "rejected"]


class DashboardDecideResponse(BaseModel):
    action_id: uuid.UUID
    decision: str
    decided_at: str | None


# ---------- Routes ----------


@router.get("/audit", response_model=AuditListResponse)
async def list_audit(
    session: DBSession,
    current_user: AuthenticatedUser,
    agent_id: uuid.UUID | None = None,
    decision: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> AuditListResponse:
    """Paginated audit log of all actions for this org's agents."""
    # Get agent IDs for this org
    agent_service = AgentService(session)
    org_agents = await agent_service.list_agents(current_user.org_id)
    org_agent_ids = {a.id for a in org_agents}
    org_agent_names = {a.id: a.name for a in org_agents}

    if not org_agent_ids:
        return AuditListResponse(items=[], total=0)

    # Build query
    query = select(Action).where(Action.agent_id.in_(org_agent_ids))

    if agent_id is not None:
        if agent_id not in org_agent_ids:
            return AuditListResponse(items=[], total=0)
        query = query.where(Action.agent_id == agent_id)

    if decision is not None:
        try:
            decision_enum = Decision(decision)
            query = query.where(Action.decision == decision_enum)
        except ValueError:
            pass

    # Count
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    # Fetch page
    result = await session.execute(
        query.order_by(Action.created_at.desc()).limit(limit).offset(offset)
    )
    actions = list(result.scalars().all())

    items = [
        AuditEntryResponse(
            id=a.id,
            agent_id=a.agent_id,
            agent_name=org_agent_names.get(a.agent_id),
            action_name=a.action_name,
            decision=a.decision.value,
            payload=a.payload or {},
            reason=a.decision_reason,
            decided_by=None,
            created_at=a.created_at.isoformat(),
            decided_at=a.decided_at.isoformat() if a.decided_at else None,
        )
        for a in actions
    ]

    return AuditListResponse(items=items, total=total)


@router.get("/audit/hourly", response_model=list[HourlyBucket])
async def hourly_audit(
    session: DBSession,
    current_user: AuthenticatedUser,
) -> list[HourlyBucket]:
    """Action counts by hour for the last 24 hours."""
    agent_service = AgentService(session)
    org_agents = await agent_service.list_agents(current_user.org_id)
    org_agent_ids = [a.id for a in org_agents]

    if not org_agent_ids:
        return []

    since = datetime.now(UTC) - timedelta(hours=24)
    result = await session.execute(
        select(Action).where(
            Action.agent_id.in_(org_agent_ids),
            Action.created_at >= since,
        )
    )
    actions = list(result.scalars().all())

    # Build 24 hourly buckets
    now = datetime.now(UTC)
    buckets: dict[str, HourlyBucket] = {}
    for i in range(23, -1, -1):
        hour_dt = now - timedelta(hours=i)
        key = hour_dt.strftime("%H:00")
        buckets[key] = HourlyBucket(hour=key, allowed=0, denied=0, pending=0)

    for action in actions:
        key = action.created_at.strftime("%H:00")
        if key not in buckets:
            continue
        if action.decision in (Decision.ALLOWED, Decision.APPROVED):
            buckets[key].allowed += 1
        elif action.decision in (Decision.DENIED, Decision.REJECTED):
            buckets[key].denied += 1
        elif action.decision == Decision.PENDING:
            buckets[key].pending += 1

    return list(buckets.values())


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    session: DBSession,
    current_user: AuthenticatedUser,
) -> StatsResponse:
    """Summary stats for the dashboard."""
    agent_service = AgentService(session)
    org_agents = await agent_service.list_agents(current_user.org_id)
    org_agent_ids = [a.id for a in org_agents]

    if not org_agent_ids:
        return StatsResponse(agent_count=len(org_agents), pending_count=0, actions_today=0)

    # Count pending
    pending_result = await session.execute(
        select(func.count(Action.id)).where(
            Action.agent_id.in_(org_agent_ids),
            Action.decision == Decision.PENDING,
        )
    )
    pending_count = pending_result.scalar_one()

    # Count actions today
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    today_result = await session.execute(
        select(func.count(Action.id)).where(
            Action.agent_id.in_(org_agent_ids),
            Action.created_at >= today_start,
        )
    )
    actions_today = today_result.scalar_one()

    return StatsResponse(
        agent_count=len(org_agents),
        pending_count=pending_count,
        actions_today=actions_today,
    )


@router.post("/check/{action_id}/decide", response_model=DashboardDecideResponse)
async def dashboard_decide(
    action_id: uuid.UUID,
    request: DashboardDecideRequest,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> DashboardDecideResponse:
    """Approve or reject a pending action from the dashboard."""
    # Verify action belongs to this org
    agent_service = AgentService(session)
    org_agents = await agent_service.list_agents(current_user.org_id)
    org_agent_ids = {a.id for a in org_agents}

    action_result = await session.execute(
        select(Action).where(
            Action.id == action_id,
            Action.agent_id.in_(org_agent_ids),
        )
    )
    action = action_result.scalar_one_or_none()
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ACTION_NOT_FOUND", "message": "Action not found"}},
        )

    approval_service = ApprovalService(session)
    try:
        result = await approval_service.decide_approval(
            action_id=action_id,
            decision=request.decision,
            decided_by_user_id=current_user.id,
        )
    except ApprovalError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "APPROVAL_NOT_FOUND", "message": "Approval request not found"}},
        )

    _, updated_action = result
    await session.commit()

    return DashboardDecideResponse(
        action_id=updated_action.id,
        decision=updated_action.decision.value,
        decided_at=updated_action.decided_at.isoformat() if updated_action.decided_at else None,
    )
