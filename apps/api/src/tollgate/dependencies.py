"""FastAPI dependencies for authentication and database sessions."""

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.database import get_session
from tollgate.middleware.auth import CurrentAgent, CurrentUser
from tollgate.models import UserRole
from tollgate.services.agent import AgentService
from tollgate.services.auth import AuthError, AuthService


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    async for session in get_session():
        yield session


DBSession = Annotated[AsyncSession, Depends(get_db_session)]


async def get_current_user(
    session: DBSession,
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Dependency that extracts and validates the current user from JWT."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "MISSING_TOKEN", "message": "Authorization header required"}},
        )

    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {"code": "INVALID_AUTH_HEADER", "message": "Invalid authorization header"}
            },
        )

    token = parts[1]

    # Verify token
    auth_service = AuthService(session)
    try:
        payload = auth_service.verify_jwt_token(token)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": e.code, "message": e.message}},
        )

    return CurrentUser(
        id=uuid.UUID(payload["sub"]),
        org_id=uuid.UUID(payload["org_id"]),
        role=UserRole(payload["role"]),
    )


AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]


async def get_current_agent(
    session: DBSession,
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentAgent:
    """Dependency that extracts and validates the current agent from API key."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "MISSING_API_KEY", "message": "Authorization header required"}},
        )

    # Extract key from "Bearer <key>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {"code": "INVALID_AUTH_HEADER", "message": "Invalid authorization header"}
            },
        )

    api_key = parts[1]

    # Validate API key
    agent_service = AgentService(session)
    agent = await agent_service.authenticate_by_api_key(api_key)

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_API_KEY", "message": "Invalid or disabled API key"}},
        )

    return CurrentAgent(
        id=agent.id,
        org_id=agent.org_id,
        name=agent.name,
    )


AuthenticatedAgent = Annotated[CurrentAgent, Depends(get_current_agent)]
