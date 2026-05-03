"""Tests for policy management endpoints."""

import pytest
from httpx import AsyncClient


SAMPLE_POLICY_YAML = """
version: 1
rules:
  - action: issue_refund
    when:
      amount: { lte: 50 }
    decide: allow
  - action: issue_refund
    when:
      amount: { gt: 50, lte: 500 }
    decide: require_approval
    approvers: ["#support-leads"]
  - action: delete_account
    decide: deny
    reason: "Account deletion never allowed for agents"
default: deny
"""


@pytest.fixture
async def agent_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    """Create an agent and return its ID."""
    response = await client.post(
        "/agents",
        json={"name": "Policy Test Agent"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.asyncio
async def test_create_policy_success(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test creating a policy."""
    response = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": SAMPLE_POLICY_YAML},
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    assert data["agent_id"] == agent_id
    assert data["version"] == 1
    assert data["is_active"] is True
    assert data["source_yaml"] == SAMPLE_POLICY_YAML
    assert "parsed_json" in data
    assert data["parsed_json"]["version"] == 1
    assert len(data["parsed_json"]["rules"]) == 3


@pytest.mark.asyncio
async def test_create_policy_invalid_yaml(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test creating a policy with invalid YAML."""
    response = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "invalid: yaml: ["},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_YAML"


@pytest.mark.asyncio
async def test_create_policy_invalid_schema(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test creating a policy with invalid schema."""
    response = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 2\nrules: []"},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_VERSION"


@pytest.mark.asyncio
async def test_create_policy_missing_action(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test creating a policy with rule missing action."""
    policy = """
version: 1
rules:
  - decide: allow
"""
    response = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": policy},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "MISSING_ACTION"


@pytest.mark.asyncio
async def test_create_policy_versions_increment(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test that policy versions auto-increment."""
    # Create first policy
    response1 = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: allow"},
        headers=auth_headers,
    )
    assert response1.status_code == 201
    assert response1.json()["version"] == 1

    # Create second policy
    response2 = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: deny"},
        headers=auth_headers,
    )
    assert response2.status_code == 201
    assert response2.json()["version"] == 2


@pytest.mark.asyncio
async def test_new_policy_deactivates_old(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test that creating a new policy deactivates the old one."""
    # Create first policy
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: allow"},
        headers=auth_headers,
    )

    # Create second policy
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: deny"},
        headers=auth_headers,
    )

    # List policies
    response = await client.get(
        f"/agents/{agent_id}/policies",
        headers=auth_headers,
    )

    assert response.status_code == 200
    policies = response.json()
    assert len(policies) == 2

    # Only version 2 should be active
    active_policies = [p for p in policies if p["is_active"]]
    assert len(active_policies) == 1
    assert active_policies[0]["version"] == 2


@pytest.mark.asyncio
async def test_list_policies(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test listing policies."""
    # Create policies
    for _ in range(3):
        await client.post(
            f"/agents/{agent_id}/policies",
            json={"source_yaml": "version: 1\nrules: []\ndefault: allow"},
            headers=auth_headers,
        )

    response = await client.get(
        f"/agents/{agent_id}/policies",
        headers=auth_headers,
    )

    assert response.status_code == 200
    policies = response.json()
    assert len(policies) == 3
    # Should be newest first
    assert policies[0]["version"] == 3
    assert policies[1]["version"] == 2
    assert policies[2]["version"] == 1


@pytest.mark.asyncio
async def test_get_active_policy(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test getting the active policy."""
    # Create policy
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": SAMPLE_POLICY_YAML},
        headers=auth_headers,
    )

    response = await client.get(
        f"/agents/{agent_id}/policies/active",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True
    assert data["version"] == 1


@pytest.mark.asyncio
async def test_get_active_policy_none(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test getting active policy when none exists."""
    response = await client.get(
        f"/agents/{agent_id}/policies/active",
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NO_ACTIVE_POLICY"


@pytest.mark.asyncio
async def test_activate_policy_version_rollback(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test activating a previous policy version (rollback)."""
    # Create multiple policies
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: allow"},
        headers=auth_headers,
    )
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []\ndefault: deny"},
        headers=auth_headers,
    )

    # Rollback to version 1
    response = await client.post(
        f"/agents/{agent_id}/policies/1/activate",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["version"] == 1
    assert response.json()["is_active"] is True

    # Verify active policy is now version 1
    active_response = await client.get(
        f"/agents/{agent_id}/policies/active",
        headers=auth_headers,
    )
    assert active_response.json()["version"] == 1


@pytest.mark.asyncio
async def test_activate_nonexistent_version(
    client: AsyncClient, auth_headers: dict[str, str], agent_id: str
) -> None:
    """Test activating a nonexistent policy version."""
    response = await client.post(
        f"/agents/{agent_id}/policies/999/activate",
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "POLICY_NOT_FOUND"


@pytest.mark.asyncio
async def test_policy_requires_auth(client: AsyncClient, agent_id: str) -> None:
    """Test that policy endpoints require authentication."""
    response = await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules: []"},
    )
    assert response.status_code == 401
