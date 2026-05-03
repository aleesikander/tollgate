"""Tests for the approval flow."""

from datetime import UTC, datetime, timedelta

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.models import Action, ApprovalRequest, ApprovalStatus


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
async def setup_agent_with_policy(
    client: AsyncClient, auth_headers: dict[str, str]
) -> tuple[str, str, str]:
    """Create an agent with policy and return (agent_id, api_key, user_id)."""
    # Get user_id from signup response (need to create a new user)
    signup_resp = await client.post(
        "/auth/signup",
        json={
            "email": "approver@example.com",
            "password": "testpassword123",
            "org_name": "Approver Org",
        },
    )
    user_id = signup_resp.json()["user_id"]
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create agent
    agent_resp = await client.post(
        "/agents",
        json={"name": "Approval Test Agent"},
        headers=headers,
    )
    agent_id = agent_resp.json()["id"]
    api_key = agent_resp.json()["api_key"]

    # Create policy
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": SAMPLE_POLICY_YAML},
        headers=headers,
    )

    return agent_id, api_key, user_id


@pytest.mark.asyncio
async def test_check_small_refund_allowed(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test that small refunds are automatically allowed."""
    _, api_key, _ = setup_agent_with_policy

    response = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 30},
            "idempotency_key": "small-refund-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "allowed"


@pytest.mark.asyncio
async def test_check_medium_refund_pending(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test that medium refunds require approval (pending)."""
    _, api_key, _ = setup_agent_with_policy

    response = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "medium-refund-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "pending"
    assert "action_id" in data


@pytest.mark.asyncio
async def test_check_delete_account_denied(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test that delete_account is denied."""
    _, api_key, _ = setup_agent_with_policy

    response = await client.post(
        "/v1/check",
        json={
            "action_name": "delete_account",
            "payload": {},
            "idempotency_key": "delete-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "denied"
    assert "never allowed" in data["reason"]


@pytest.mark.asyncio
async def test_check_unknown_action_denied(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test that unknown actions are denied by default."""
    _, api_key, _ = setup_agent_with_policy

    response = await client.post(
        "/v1/check",
        json={
            "action_name": "unknown_action",
            "payload": {},
            "idempotency_key": "unknown-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "denied"


@pytest.mark.asyncio
async def test_poll_pending_action(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test polling a pending action returns pending status."""
    _, api_key, _ = setup_agent_with_policy

    # Create pending action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "poll-pending-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # Poll status
    status_resp = await client.get(
        f"/v1/check/{action_id}",
        headers={"Authorization": f"Bearer {api_key}"},
    )

    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["decision"] == "pending"
    assert data["action_id"] == action_id


@pytest.mark.asyncio
async def test_decide_approve_action(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test approving a pending action."""
    _, api_key, user_id = setup_agent_with_policy

    # Create pending action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "approve-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # Approve
    decide_resp = await client.post(
        f"/v1/actions/{action_id}/decide",
        json={"decision": "approved", "user_id": user_id},
    )

    assert decide_resp.status_code == 200
    data = decide_resp.json()
    assert data["decision"] == "approved"

    # Poll should now show approved
    status_resp = await client.get(
        f"/v1/check/{action_id}",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert status_resp.json()["decision"] == "approved"


@pytest.mark.asyncio
async def test_decide_reject_action(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test rejecting a pending action."""
    _, api_key, user_id = setup_agent_with_policy

    # Create pending action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "reject-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # Reject
    decide_resp = await client.post(
        f"/v1/actions/{action_id}/decide",
        json={"decision": "rejected", "user_id": user_id},
    )

    assert decide_resp.status_code == 200
    data = decide_resp.json()
    assert data["decision"] == "rejected"


@pytest.mark.asyncio
async def test_decide_already_decided(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test that deciding on already decided action fails."""
    _, api_key, user_id = setup_agent_with_policy

    # Create and approve action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "double-decide-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # First decision
    await client.post(
        f"/v1/actions/{action_id}/decide",
        json={"decision": "approved", "user_id": user_id},
    )

    # Second decision should fail
    decide_resp = await client.post(
        f"/v1/actions/{action_id}/decide",
        json={"decision": "rejected", "user_id": user_id},
    )

    assert decide_resp.status_code == 400
    assert decide_resp.json()["error"]["code"] == "NOT_PENDING"


@pytest.mark.asyncio
async def test_decide_nonexistent_action(
    client: AsyncClient, setup_agent_with_policy: tuple[str, str, str]
) -> None:
    """Test deciding on nonexistent action returns 404."""
    _, _, user_id = setup_agent_with_policy

    decide_resp = await client.post(
        "/v1/actions/00000000-0000-0000-0000-000000000000/decide",
        json={"decision": "approved", "user_id": user_id},
    )

    assert decide_resp.status_code == 404


@pytest.mark.asyncio
async def test_approval_expiry(
    client: AsyncClient,
    setup_agent_with_policy: tuple[str, str, str],
    test_session: AsyncSession,
) -> None:
    """Test that expired approvals are marked as rejected."""
    _, api_key, user_id = setup_agent_with_policy

    # Create pending action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "expiry-test-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # Manually set expires_at to past
    await test_session.execute(
        update(ApprovalRequest)
        .where(ApprovalRequest.action_id == action_id)
        .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await test_session.commit()

    # Run expiry service
    from tollgate.services.approval import ApprovalService
    approval_service = ApprovalService(test_session)
    expired_ids = await approval_service.expire_pending_approvals()

    assert len(expired_ids) == 1

    # Check action is now rejected
    result = await test_session.execute(
        select(Action).where(Action.id == action_id)
    )
    action = result.scalar_one()
    assert action.decision.value == "rejected"
    assert action.decision_reason == "approval timed out"


@pytest.mark.asyncio
async def test_decide_expired_action(
    client: AsyncClient,
    setup_agent_with_policy: tuple[str, str, str],
    test_session: AsyncSession,
) -> None:
    """Test that deciding on expired action fails."""
    _, api_key, user_id = setup_agent_with_policy

    # Create pending action
    check_resp = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 200},
            "idempotency_key": "expired-decide-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    action_id = check_resp.json()["action_id"]

    # Manually set expires_at to past
    await test_session.execute(
        update(ApprovalRequest)
        .where(ApprovalRequest.action_id == action_id)
        .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await test_session.commit()

    # Try to decide
    decide_resp = await client.post(
        f"/v1/actions/{action_id}/decide",
        json={"decision": "approved", "user_id": user_id},
    )

    assert decide_resp.status_code == 400
    assert decide_resp.json()["error"]["code"] == "EXPIRED"


@pytest.mark.asyncio
async def test_policy_rollback_affects_check(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Test that rolling back policy version affects /v1/check."""
    # Create agent
    agent_resp = await client.post(
        "/agents",
        json={"name": "Rollback Test Agent"},
        headers=auth_headers,
    )
    agent_id = agent_resp.json()["id"]
    api_key = agent_resp.json()["api_key"]

    # Create policy v1 - allow all refunds
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules:\n  - action: issue_refund\n    decide: allow\ndefault: deny"},
        headers=auth_headers,
    )

    # Create policy v2 - deny all refunds
    await client.post(
        f"/agents/{agent_id}/policies",
        json={"source_yaml": "version: 1\nrules:\n  - action: issue_refund\n    decide: deny\ndefault: deny"},
        headers=auth_headers,
    )

    # Check with v2 active - should be denied
    check1 = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 100},
            "idempotency_key": "rollback-check-1",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert check1.json()["decision"] == "denied"

    # Rollback to v1
    await client.post(
        f"/agents/{agent_id}/policies/1/activate",
        headers=auth_headers,
    )

    # Check with v1 active - should be allowed
    check2 = await client.post(
        "/v1/check",
        json={
            "action_name": "issue_refund",
            "payload": {"amount": 100},
            "idempotency_key": "rollback-check-2",
        },
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert check2.json()["decision"] == "allowed"
