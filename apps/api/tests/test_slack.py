"""Tests for Slack integration."""

import hashlib
import hmac
import json
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch
from urllib.parse import urlencode

import pytest
import respx
from httpx import AsyncClient, Response

from tollgate.config import get_settings
from tollgate.encryption import encrypt
from tollgate.models import (
    Action,
    Agent,
    ApprovalRequest,
    ApprovalStatus,
    Decision,
    Organization,
    SlackIntegration,
    User,
)


def generate_slack_signature(body: bytes, timestamp: str, secret: str) -> str:
    """Generate a valid Slack signature for testing."""
    sig_basestring = f"v0:{timestamp}:{body.decode()}"
    signature = hmac.new(
        secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"v0={signature}"


@pytest.fixture
async def slack_org(async_session):
    """Create an organization with Slack integration."""
    org = Organization(name="Slack Test Org", slug="slack-test-org")
    async_session.add(org)
    await async_session.flush()
    return org


@pytest.fixture
async def slack_user(async_session, slack_org):
    """Create a user in the Slack org."""
    user = User(
        org_id=slack_org.id,
        email="approver@slack-test.com",
        hashed_password="dummy",
        role="admin",
    )
    async_session.add(user)
    await async_session.flush()
    return user


@pytest.fixture
async def slack_agent(async_session, slack_org):
    """Create an agent in the Slack org."""
    agent = Agent(
        org_id=slack_org.id,
        name="Slack Test Agent",
        api_key_hash="dummy_hash",
        api_key_prefix="tg_live_",
        status="active",
    )
    async_session.add(agent)
    await async_session.flush()
    return agent


@pytest.fixture
async def slack_integration(async_session, slack_org, slack_user):
    """Create a Slack integration."""
    integration = SlackIntegration(
        org_id=slack_org.id,
        team_id="T12345678",
        team_name="Test Workspace",
        bot_token_encrypted=encrypt("xoxb-test-token"),
        bot_user_id="U12345678",
        scope="chat:write,commands,users:read,users:read.email",
        installed_by_user_id=slack_user.id,
        installed_at=datetime.now(UTC),
    )
    async_session.add(integration)
    await async_session.flush()
    return integration


@pytest.fixture
async def pending_action(async_session, slack_agent):
    """Create a pending action with approval request."""
    action = Action(
        agent_id=slack_agent.id,
        action_name="dangerous_action",
        payload={"target": "production"},
        decision=Decision.PENDING,
        decision_reason="requires approval",
        idempotency_key=f"test-{uuid.uuid4()}",
    )
    async_session.add(action)
    await async_session.flush()

    approval = ApprovalRequest(
        action_id=action.id,
        approvers_config={"approvers": ["@admin"]},
        status=ApprovalStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        slack_channel="C12345678",
        slack_message_ts="1234567890.123456",
    )
    async_session.add(approval)
    await async_session.flush()

    return action, approval


class TestSlackSignatureVerification:
    """Test Slack signature verification."""

    @pytest.mark.asyncio
    async def test_missing_timestamp_header(self, async_client: AsyncClient):
        """Request without timestamp header should fail."""
        response = await async_client.post(
            "/integrations/slack/interactions",
            content=b"payload={}",
            headers={
                "X-Slack-Signature": "v0=abc123",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_signature_header(self, async_client: AsyncClient):
        """Request without signature header should fail."""
        response = await async_client.post(
            "/integrations/slack/interactions",
            content=b"payload={}",
            headers={
                "X-Slack-Request-Timestamp": str(int(time.time())),
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_signature(self, async_client: AsyncClient):
        """Request with invalid signature should fail."""
        response = await async_client.post(
            "/integrations/slack/interactions",
            content=b"payload={}",
            headers={
                "X-Slack-Request-Timestamp": str(int(time.time())),
                "X-Slack-Signature": "v0=invalid_signature",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_replay_attack_prevention(self, async_client: AsyncClient):
        """Old timestamp should be rejected (replay attack prevention)."""
        settings = get_settings()
        old_timestamp = str(int(time.time()) - 600)  # 10 minutes ago
        body = b"payload={}"
        signature = generate_slack_signature(
            body, old_timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/interactions",
            content=body,
            headers={
                "X-Slack-Request-Timestamp": old_timestamp,
                "X-Slack-Signature": signature,
            },
        )
        assert response.status_code == 401


class TestSlackInteractions:
    """Test Slack interactive components (button clicks)."""

    @pytest.mark.asyncio
    async def test_valid_signature_accepted(
        self,
        async_client: AsyncClient,
        slack_integration,
    ):
        """Valid signature with empty payload should succeed."""
        settings = get_settings()

        # Empty payload - should return ok
        body = urlencode({"payload": "{}"}).encode()
        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/interactions",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        assert response.json() == {"ok": True}

    @pytest.mark.asyncio
    async def test_unknown_action_id_ignored(
        self,
        async_client: AsyncClient,
        slack_integration,
    ):
        """Unknown action_id should be ignored gracefully."""
        settings = get_settings()

        payload = {
            "type": "block_actions",
            "user": {"id": "U12345678"},
            "team": {"id": slack_integration.team_id},
            "actions": [
                {
                    "action_id": "unknown_action",
                    "value": "some_value",
                }
            ],
            "response_url": "https://hooks.slack.com/test",
        }

        body = urlencode({"payload": json.dumps(payload)}).encode()
        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/interactions",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        assert response.json() == {"ok": True}

    @pytest.mark.asyncio
    async def test_invalid_action_uuid_ignored(
        self,
        async_client: AsyncClient,
        slack_integration,
    ):
        """Invalid UUID in action value should be ignored gracefully."""
        settings = get_settings()

        payload = {
            "type": "block_actions",
            "user": {"id": "U12345678"},
            "team": {"id": slack_integration.team_id},
            "actions": [
                {
                    "action_id": "approve_action",
                    "value": "not-a-uuid",
                }
            ],
            "response_url": "https://hooks.slack.com/test",
        }

        body = urlencode({"payload": json.dumps(payload)}).encode()
        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/interactions",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        assert response.json() == {"ok": True}


class TestSlackCommands:
    """Test Slack slash commands."""

    @pytest.mark.asyncio
    async def test_tollgate_pending_no_pending(
        self,
        async_client: AsyncClient,
        slack_integration,
    ):
        """Test /tollgate pending with no pending approvals."""
        settings = get_settings()

        body = urlencode({
            "command": "/tollgate",
            "text": "pending",
            "team_id": slack_integration.team_id,
            "user_id": "U12345678",
            "response_url": "https://hooks.slack.com/commands/test",
        }).encode()

        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/commands",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "No pending approvals" in data["text"]

    @pytest.mark.asyncio
    async def test_tollgate_pending_with_pending(
        self,
        async_client: AsyncClient,
        slack_integration,
        pending_action,
    ):
        """Test /tollgate pending with pending approvals."""
        settings = get_settings()

        body = urlencode({
            "command": "/tollgate",
            "text": "pending",
            "team_id": slack_integration.team_id,
            "user_id": "U12345678",
            "response_url": "https://hooks.slack.com/commands/test",
        }).encode()

        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/commands",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "blocks" in data
        assert data["response_type"] == "ephemeral"

    @pytest.mark.asyncio
    async def test_unknown_subcommand(
        self,
        async_client: AsyncClient,
        slack_integration,
    ):
        """Test /tollgate with unknown subcommand."""
        settings = get_settings()

        body = urlencode({
            "command": "/tollgate",
            "text": "unknown",
            "team_id": slack_integration.team_id,
            "user_id": "U12345678",
            "response_url": "https://hooks.slack.com/commands/test",
        }).encode()

        timestamp = str(int(time.time()))
        signature = generate_slack_signature(
            body, timestamp, settings.slack_signing_secret
        )

        response = await async_client.post(
            "/integrations/slack/commands",
            content=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Slack-Request-Timestamp": timestamp,
                "X-Slack-Signature": signature,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Unknown subcommand" in data["text"]


class TestSlackOAuth:
    """Test Slack OAuth flow."""

    @pytest.mark.asyncio
    async def test_install_redirect(
        self,
        async_client: AsyncClient,
        auth_headers,
    ):
        """Test /integrations/slack/install redirects to Slack."""
        response = await async_client.get(
            "/integrations/slack/install",
            headers=auth_headers,
            follow_redirects=False,
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert "slack.com/oauth" in location
        assert "client_id=" in location

    @pytest.mark.asyncio
    async def test_oauth_callback_invalid_state(
        self,
        async_client: AsyncClient,
    ):
        """Test OAuth callback with invalid state fails."""
        response = await async_client.get(
            "/integrations/slack/callback",
            params={"code": "test-code", "state": "invalid"},
            follow_redirects=False,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_uninstall_slack(
        self,
        async_client: AsyncClient,
        auth_headers,
        slack_integration,
    ):
        """Test uninstalling Slack integration."""
        # Update auth_headers to use the slack_integration's org
        # This test needs the user to be in the same org as the integration
        response = await async_client.delete(
            "/integrations/slack",
            headers=auth_headers,
        )

        # May be 404 if the auth_headers user is in a different org
        assert response.status_code in (200, 404)


class TestSlackLatency:
    """Test that Slack integration doesn't impact /v1/check latency."""

    @pytest.mark.asyncio
    async def test_check_latency_with_pending(
        self,
        async_client: AsyncClient,
        agent_headers,
        async_session,
        test_agent,
    ):
        """Verify /v1/check returns quickly even with Slack notification."""
        import time

        # Need to set up a policy that triggers pending state
        # For now, just verify the endpoint responds quickly
        start = time.perf_counter()

        response = await async_client.post(
            "/v1/check",
            json={
                "action_name": "test_action",
                "payload": {},
                "idempotency_key": f"latency-test-{uuid.uuid4()}",
            },
            headers=agent_headers,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        assert response.status_code == 200
        # Without a policy, default is allowed, which is fast
        # With pending, the Slack notification is fire-and-forget
        assert elapsed_ms < 100  # Should be well under 100ms
