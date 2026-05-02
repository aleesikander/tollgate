"""Agent management routes."""

import uuid

from fastapi import APIRouter, HTTPException, status

from tollgate.dependencies import AuthenticatedUser, DBSession
from tollgate.schemas import AgentResponse, AgentWithKeyResponse, CreateAgentRequest
from tollgate.services.agent import AgentService

router = APIRouter()


@router.post("", response_model=AgentWithKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    request: CreateAgentRequest,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> AgentWithKeyResponse:
    """Create a new agent. Returns the API key ONCE - it cannot be retrieved later."""
    agent_service = AgentService(session)
    agent, api_key = await agent_service.create_agent(
        org_id=current_user.org_id,
        name=request.name,
    )

    return AgentWithKeyResponse(
        id=agent.id,
        name=agent.name,
        api_key=api_key,
        api_key_prefix=agent.api_key_prefix,
        status=agent.status,
        created_at=agent.created_at,
    )


@router.get("", response_model=list[AgentResponse])
async def list_agents(
    session: DBSession,
    current_user: AuthenticatedUser,
) -> list[AgentResponse]:
    """List all agents for the current organization."""
    agent_service = AgentService(session)
    agents = await agent_service.list_agents(current_user.org_id)

    return [
        AgentResponse(
            id=agent.id,
            name=agent.name,
            api_key_prefix=agent.api_key_prefix,
            status=agent.status,
            created_at=agent.created_at,
        )
        for agent in agents
    ]


@router.delete("/{agent_id}", response_model=AgentResponse)
async def disable_agent(
    agent_id: uuid.UUID,
    session: DBSession,
    current_user: AuthenticatedUser,
) -> AgentResponse:
    """Disable an agent."""
    agent_service = AgentService(session)
    agent = await agent_service.disable_agent(agent_id, current_user.org_id)

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "AGENT_NOT_FOUND", "message": "Agent not found"}},
        )

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        api_key_prefix=agent.api_key_prefix,
        status=agent.status,
        created_at=agent.created_at,
    )
