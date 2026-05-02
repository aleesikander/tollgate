"""Check endpoint for agent action requests."""

from fastapi import APIRouter

from tollgate.dependencies import AuthenticatedAgent, DBSession
from tollgate.schemas import CheckRequest, CheckResponse
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
    perform an action. Currently always returns "allowed" with reason
    "no policies configured" - policy evaluation will be added later.

    Idempotency: Using the same idempotency_key for the same agent will
    return the original decision without creating a new action record.
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
