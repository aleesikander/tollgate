"""Tests for agent management endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.models import Agent


@pytest.mark.asyncio
async def test_create_agent_returns_key_once(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test agent creation returns API key only once."""
    response = await client.post(
        "/agents",
        json={"name": "My Agent"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    assert "id" in data
    assert data["name"] == "My Agent"
    assert "api_key" in data
    assert data["api_key"].startswith("tg_live_")
    assert len(data["api_key"]) == 40  # tg_live_ (8) + 32 hex chars
    assert data["api_key_prefix"] == data["api_key"][:11]
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_agent_key_is_hashed_in_db(
    client: AsyncClient, auth_headers: dict[str, str], test_session: AsyncSession
) -> None:
    """Test that API key is stored as HMAC-SHA256 hash, not plaintext."""
    response = await client.post(
        "/agents",
        json={"name": "Hash Test Agent"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    api_key = data["api_key"]

    # Check the database directly
    result = await test_session.execute(select(Agent).where(Agent.id == data["id"]))
    agent = result.scalar_one()

    # API key should NOT be stored as plaintext
    assert agent.api_key_hash != api_key
    # Should be an HMAC-SHA256 hash (64 hex chars, deterministic)
    assert len(agent.api_key_hash) == 64
    assert all(c in "0123456789abcdef" for c in agent.api_key_hash)
    # Prefix should match
    assert agent.api_key_prefix == api_key[:11]


@pytest.mark.asyncio
async def test_api_key_hmac_is_deterministic(
    client: AsyncClient, auth_headers: dict[str, str], test_session: AsyncSession
) -> None:
    """Test that HMAC hash is deterministic for the same input."""
    from tollgate.services.agent import AgentService

    response = await client.post(
        "/agents",
        json={"name": "HMAC Test Agent"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    api_key = data["api_key"]

    # Get the stored hash
    result = await test_session.execute(select(Agent).where(Agent.id == data["id"]))
    agent = result.scalar_one()
    stored_hash = agent.api_key_hash

    # Create a new service instance and hash the same key
    service = AgentService(test_session)
    computed_hash = service._hash_api_key(api_key)

    # HMAC is deterministic - same input always produces same output
    assert computed_hash == stored_hash


@pytest.mark.asyncio
async def test_list_agents_no_full_keys(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test that list agents returns prefixes, not full keys."""
    # Create an agent
    await client.post(
        "/agents",
        json={"name": "List Test Agent"},
        headers=auth_headers,
    )

    # List agents
    response = await client.get("/agents", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert len(data) >= 1
    agent = data[0]
    assert "api_key" not in agent  # Full key should not be returned
    assert "api_key_prefix" in agent
    assert agent["api_key_prefix"].startswith("tg_live_")


@pytest.mark.asyncio
async def test_disable_agent(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test disabling an agent."""
    # Create an agent
    create_response = await client.post(
        "/agents",
        json={"name": "Disable Test Agent"},
        headers=auth_headers,
    )
    agent_id = create_response.json()["id"]

    # Disable the agent
    response = await client.delete(f"/agents/{agent_id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "disabled"


@pytest.mark.asyncio
async def test_disable_nonexistent_agent(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test disabling a nonexistent agent returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.delete(f"/agents/{fake_id}", headers=auth_headers)

    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "AGENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_create_agent_requires_auth(client: AsyncClient) -> None:
    """Test that agent creation requires authentication."""
    response = await client.post(
        "/agents",
        json={"name": "Unauthorized Agent"},
    )

    assert response.status_code == 401
