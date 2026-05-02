"""Tests for the /v1/check endpoint."""

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.models import Action


@pytest.mark.asyncio
async def test_check_with_valid_key_returns_allowed(
    client: AsyncClient, agent_headers: dict[str, str]
) -> None:
    """Test that /v1/check with valid key returns allowed."""
    response = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {"amount": 100, "currency": "USD"},
            "idempotency_key": "unique-key-1",
        },
        headers=agent_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["decision"] == "allowed"
    assert "action_id" in data
    assert data["reason"] == "no policies configured"


@pytest.mark.asyncio
async def test_check_persists_action(
    client: AsyncClient, agent_headers: dict[str, str], test_session: AsyncSession
) -> None:
    """Test that /v1/check persists the action to the database."""
    response = await client.post(
        "/v1/check",
        json={
            "action_name": "account_change",
            "payload": {"user_id": "123"},
            "idempotency_key": "persist-test-key",
        },
        headers=agent_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Check database
    result = await test_session.execute(select(Action).where(Action.id == data["action_id"]))
    action = result.scalar_one()

    assert action.action_name == "account_change"
    assert action.payload == {"user_id": "123"}
    assert action.idempotency_key == "persist-test-key"
    assert action.decision.value == "allowed"


@pytest.mark.asyncio
async def test_check_with_invalid_key_returns_401(client: AsyncClient) -> None:
    """Test that /v1/check with invalid key returns 401."""
    response = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {},
            "idempotency_key": "invalid-key-test",
        },
        headers={"Authorization": "Bearer tg_live_invalidkey12345678901234567890"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_API_KEY"
    # Ensure no HTML/stack trace
    assert "<" not in str(data)


@pytest.mark.asyncio
async def test_check_with_disabled_agent_returns_401(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test that /v1/check with disabled agent returns 401."""
    # Create agent
    create_response = await client.post(
        "/agents",
        json={"name": "Disabled Agent"},
        headers=auth_headers,
    )
    api_key = create_response.json()["api_key"]
    agent_id = create_response.json()["id"]

    # Disable agent
    await client.delete(f"/agents/{agent_id}", headers=auth_headers)

    # Try to use disabled agent
    response = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {},
            "idempotency_key": "disabled-agent-test",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_idempotency_same_key_returns_same_response(
    client: AsyncClient, agent_headers: dict[str, str]
) -> None:
    """Test that same idempotency key returns same action_id."""
    idempotency_key = "idempotent-test-key"

    # First request
    response1 = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {"amount": 50},
            "idempotency_key": idempotency_key,
        },
        headers=agent_headers,
    )

    assert response1.status_code == 200
    data1 = response1.json()

    # Second request with same key
    response2 = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {"amount": 50},
            "idempotency_key": idempotency_key,
        },
        headers=agent_headers,
    )

    assert response2.status_code == 200
    data2 = response2.json()

    # Should return the same action_id
    assert data1["action_id"] == data2["action_id"]


@pytest.mark.asyncio
async def test_idempotency_creates_only_one_row(
    client: AsyncClient, agent_headers: dict[str, str], test_session: AsyncSession
) -> None:
    """Test that same idempotency key creates only one database row."""
    idempotency_key = "single-row-test-key"

    # Make multiple requests with same key
    for _ in range(3):
        response = await client.post(
            "/v1/check",
            json={
                "action_name": "refund",
                "payload": {},
                "idempotency_key": idempotency_key,
            },
            headers=agent_headers,
        )
        assert response.status_code == 200

    # Count rows with this idempotency key
    result = await test_session.execute(
        select(func.count()).select_from(Action).where(Action.idempotency_key == idempotency_key)
    )
    count = result.scalar()

    assert count == 1


@pytest.mark.asyncio
async def test_check_missing_api_key_returns_401(client: AsyncClient) -> None:
    """Test that missing API key returns 401."""
    response = await client.post(
        "/v1/check",
        json={
            "action_name": "refund",
            "payload": {},
            "idempotency_key": "no-auth-test",
        },
    )

    assert response.status_code == 401
