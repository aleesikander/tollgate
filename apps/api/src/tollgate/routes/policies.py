"""Policy management routes."""

import uuid

from fastapi import APIRouter, HTTPException, status

from tollgate.dependencies import AuthenticatedUser, DBSession
from tollgate.schemas import CreatePolicyRequest, PolicyResponse, PolicySummaryResponse
from tollgate.services.agent import AgentService
from tollgate.services.policy import PolicyError, PolicyService
from tollgate.services.policy_cache import get_policy_cache

router = APIRouter()


async def _verify_agent_ownership(
    session: DBSession,
    agent_id: uuid.UUID,
    current_user: AuthenticatedUser,
) -> None:
    """Verify the agent belongs to the user's organization."""
    agent_service = AgentService(session)
    agent = await agent_service.get_agent(agent_id, current_user.org_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "AGENT_NOT_FOUND", "message": "Agent not found"}},
        )


@router.post(
    "/agents/{agent_id}/policies",
    response_model=PolicyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_policy(
    agent_id: uuid.UUID,
    request: CreatePolicyRequest,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> PolicyResponse:
    """Create a new policy for an agent.

    Validates the YAML, creates a new active version, and deactivates the previous active policy.
    """
    await _verify_agent_ownership(session, agent_id, current_user)

    policy_service = PolicyService(session)
    try:
        policy = await policy_service.create_policy(
            agent_id=agent_id,
            source_yaml=request.source_yaml,
            created_by_user_id=current_user.id,
        )
    except PolicyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    # Invalidate cache
    get_policy_cache().invalidate(agent_id)

    return PolicyResponse(
        id=policy.id,
        agent_id=policy.agent_id,
        version=policy.version,
        source_yaml=policy.source_yaml,
        parsed_json=policy.parsed_json,
        is_active=policy.is_active,
        created_at=policy.created_at,
        created_by_user_id=policy.created_by_user_id,
    )


@router.get("/agents/{agent_id}/policies", response_model=list[PolicySummaryResponse])
async def list_policies(
    agent_id: uuid.UUID,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> list[PolicySummaryResponse]:
    """List all policy versions for an agent, newest first."""
    await _verify_agent_ownership(session, agent_id, current_user)

    policy_service = PolicyService(session)
    policies = await policy_service.list_policies(agent_id)

    return [
        PolicySummaryResponse(
            id=p.id,
            version=p.version,
            is_active=p.is_active,
            created_at=p.created_at,
        )
        for p in policies
    ]


@router.get("/agents/{agent_id}/policies/active", response_model=PolicyResponse)
async def get_active_policy(
    agent_id: uuid.UUID,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> PolicyResponse:
    """Get the currently active policy for an agent."""
    await _verify_agent_ownership(session, agent_id, current_user)

    policy_service = PolicyService(session)
    policy = await policy_service.get_active_policy(agent_id)

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NO_ACTIVE_POLICY", "message": "No active policy found"}},
        )

    return PolicyResponse(
        id=policy.id,
        agent_id=policy.agent_id,
        version=policy.version,
        source_yaml=policy.source_yaml,
        parsed_json=policy.parsed_json,
        is_active=policy.is_active,
        created_at=policy.created_at,
        created_by_user_id=policy.created_by_user_id,
    )


@router.post(
    "/agents/{agent_id}/policies/{version}/activate",
    response_model=PolicyResponse,
)
async def activate_policy_version(
    agent_id: uuid.UUID,
    version: int,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> PolicyResponse:
    """Activate a specific policy version (rollback)."""
    await _verify_agent_ownership(session, agent_id, current_user)

    policy_service = PolicyService(session)
    policy = await policy_service.activate_policy_version(agent_id, version)

    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "POLICY_NOT_FOUND", "message": f"Policy version {version} not found"}},
        )

    # Invalidate cache
    get_policy_cache().invalidate(agent_id)

    return PolicyResponse(
        id=policy.id,
        agent_id=policy.agent_id,
        version=policy.version,
        source_yaml=policy.source_yaml,
        parsed_json=policy.parsed_json,
        is_active=policy.is_active,
        created_at=policy.created_at,
        created_by_user_id=policy.created_by_user_id,
    )
