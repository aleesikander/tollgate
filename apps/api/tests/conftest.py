"""Test fixtures and configuration."""

import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tollgate.database import reset_engine
from tollgate.dependencies import get_db_session
from tollgate.main import app
from tollgate.models import Agent, Base, Organization, User

# Use test database
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://tollgate_test:tollgate_test@localhost:5433/tollgate_test",
)


@pytest.fixture(scope="function")
async def test_engine():
    """Create a test database engine for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Drop and recreate all tables for each test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with session_factory() as session:
        yield session


@pytest.fixture(scope="function")
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client with overridden database session."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield test_session

    # Reset engine to force new connection
    reset_engine()

    # Override the dependency
    app.dependency_overrides[get_db_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Create a user and return auth headers."""
    response = await client.post(
        "/auth/signup",
        json={
            "email": "test@example.com",
            "password": "testpassword123",
            "org_name": "Test Org",
        },
    )
    assert response.status_code == 201, f"Signup failed: {response.json()}"
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture
async def agent_api_key(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    """Create an agent and return its API key."""
    response = await client.post(
        "/agents",
        json={"name": "Test Agent"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    return data["api_key"]


@pytest.fixture
async def agent_headers(agent_api_key: str) -> dict[str, str]:
    """Return headers with agent API key."""
    return {"Authorization": f"Bearer {agent_api_key}"}


# Async session for direct model manipulation in tests
@pytest.fixture
async def async_session(test_session: AsyncSession) -> AsyncSession:
    """Alias for test_session for consistency with test_slack.py naming."""
    return test_session


@pytest.fixture
async def async_client(client: AsyncClient) -> AsyncClient:
    """Alias for client for consistency with test_slack.py naming."""
    return client


# Fixtures for Slack tests that need direct model access
@pytest.fixture
async def test_org(async_session: AsyncSession) -> Organization:
    """Create a test organization."""
    org = Organization(name="Test Org", slug="test-org")
    async_session.add(org)
    await async_session.flush()
    return org


@pytest.fixture
async def test_user(async_session: AsyncSession, test_org: Organization) -> User:
    """Create a test user."""
    import bcrypt

    user = User(
        org_id=test_org.id,
        email="test@test-org.com",
        hashed_password=bcrypt.hashpw("testpassword123".encode(), bcrypt.gensalt()).decode(),
        role="owner",
    )
    async_session.add(user)
    await async_session.flush()
    return user


@pytest.fixture
async def test_agent(async_session: AsyncSession, test_org: Organization) -> Agent:
    """Create a test agent with known API key."""
    from tollgate.services.agent import AgentService

    # Create agent via service to get proper key hashing
    agent_service = AgentService(async_session)
    agent, api_key = await agent_service.create_agent(
        org_id=test_org.id,
        name="Test Agent",
    )
    # Store the API key on the agent object for tests
    agent._test_api_key = api_key  # type: ignore
    return agent
