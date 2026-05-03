"""Action management routes (internal/dashboard endpoints)."""

import uuid

from fastapi import APIRouter, HTTPException, status

from tollgate.dependencies import DBSession
from tollgate.schemas import DecideRequest, DecideResponse
from tollgate.services.approval import ApprovalError, ApprovalService

router = APIRouter()


@router.post("/actions/{action_id}/decide", response_model=DecideResponse)
async def decide_action(
    action_id: uuid.UUID,
    request: DecideRequest,
    session: DBSession,
) -> DecideResponse:
    """Decide on a pending approval request.

    This is a temporary internal endpoint for testing the approval flow
    without Slack. It will be replaced by the Slack interaction handler
    in prompt 3, but kept as a dashboard-internal endpoint.

    Body:
    - decision: "approved" or "rejected"
    - user_id: UUID of the user making the decision
    """
    approval_service = ApprovalService(session)

    try:
        result = await approval_service.decide_approval(
            action_id=action_id,
            decision=request.decision,
            decided_by_user_id=request.user_id,
        )
    except ApprovalError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ACTION_NOT_FOUND", "message": "Action or approval request not found"}},
        )

    approval, action = result

    return DecideResponse(
        action_id=action.id,
        decision=action.decision.value,
        decided_at=action.decided_at.isoformat() if action.decided_at else "",
    )
