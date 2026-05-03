"""Check endpoint for agent action requests."""

import uuid

from fastapi import APIRouter, HTTPException, status

from tollgate.dependencies import AuthenticatedAgent, DBSession
from tollgate.schemas import ActionStatusResponse, CheckRequest, CheckResponse
from tollgate.services.action import ActionService

router = APIRouter()


@router.post("/check", response_model=CheckResponse)
async def check_action(
    request: CheckRequest,
    session: DBSession,
    current_agent: AuthenticatedAgent,
) -> CheckResponse:
    """Check if an action is allowed.

    This endpoint is called by AI agents to check if they're allowed to
    perform an action. The decision is based on the agent's active policy.

    Idempotency: Using the same idempotency_key for the same agent will
    return the original decision without creating a new action record.

    Possible decisions:
    - allowed: Action can proceed
    - denied: Action is not permitted
    - pending: Action requires approval (use GET /v1/check/{action_id} to poll)
    """
    action_service = ActionService(session)
    action = await action_service.check_action(
        agent_id=current_agent.id,
        action_name=request.action_name,
        payload=request.payload,
        idempotency_key=request.idempotency_key,
    )

    # Map Decision enum to response literal
    decision_map = {
        "allowed": "allowed",
        "denied": "denied",
        "pending": "pending",
        "approved": "allowed",  # approved maps to allowed for API response
        "rejected": "denied",  # rejected maps to denied for API response
    }

    return CheckResponse(
        decision=decision_map[action.decision.value],  # type: ignore[arg-type]
        action_id=action.id,
        reason=action.decision_reason or "",
    )


@router.get("/check/{action_id}", response_model=ActionStatusResponse)
async def get_action_status(
    action_id: uuid.UUID,
    session: DBSession,
    current_agent: AuthenticatedAgent,
) -> ActionStatusResponse:
    """Poll for action decision status.

    Used by SDKs to wait for approval on pending actions.
    Returns the current decision status of the action.
    """
    action_service = ActionService(session)
    action = await action_service.get_action_for_agent(action_id, current_agent.id)

    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ACTION_NOT_FOUND", "message": "Action not found"}},
        )

    return ActionStatusResponse(
        action_id=action.id,
        decision=action.decision.value,
        reason=action.decision_reason or "",
    )
