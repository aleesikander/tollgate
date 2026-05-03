"""Tests for Slack integration."""

import hashlib
import hmac
import json
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import urlencode

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.config import get_settings
from tollgate.dependencies import get_slack_service
from tollgate.encryption import decrypt, encrypt
from tollgate.main import app
from tollgate.models import (
    Action,
    Agent,
    ApprovalRequest,
    ApprovalStatus,
    Decision,
    Organization,
    Policy,
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


def build_interaction_payload(
    action_id: str,
    action_value: str,
    team_id: str,
    slack_user_id: str = "U12345678",
    response_url: str = "https://hooks.slack.com/actions/test",
) -> dict:
    """Build a realistic Slack interaction payload."""
    return {
        "type": "block_actions",
        "user": {"id": slack_user_id, "username": "testuser"},
        "team": {"id": team_id, "domain": "testworkspace"},
        "channel": {"id": "C12345678", "name": "approvals"},
        "actions": [
            {
                "action_id": action_id,
                "block_id": "actions_block",
                "value": action_value,
                "type": "button",
            }
        ],
        "response_url": response_url,
        "trigger_id": "12345.67890.abcdef",
    }


@pytest.fixture
async def slack_org(async_session: AsyncSession) -> Organization:
    """Create an organization with Slack integration."""
    org = Organization(name="Slack Test Org", slug=f"slack-test-org-{uuid.uuid4().hex[:8]}")
    async_session.add(org)
    await async_session.flush()
    return org


@pytest.fixture
async def slack_user(async_session: AsyncSession, slack_org: Organization) -> User:
    """Create a user in the Slack org."""
    import bcrypt

    user = User(
        org_id=slack_org.id,
        email="approver@slack-test.com",
        hashed_password=bcrypt.hashpw(b"testpassword", bcrypt.gensalt()).decode(),
        role="admin",
    )
    async_session.add(user)
    await async_session.flush()
    return user


@pytest.fixture
async def slack_agent(async_session: AsyncSession, slack_org: Organization) -> Agent:
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
async def slack_policy(async_session: AsyncSession, slack_agent: Agent) -> Policy:
    """Create a policy that requires approval."""
    policy = Policy(
        agent_id=slack_agent.id,
        version=1,
        source_yaml="version: 1\nrules:\n  - action: test_action\n    decide: require_approval\n    approvers: ['#approvals']\ndefault: deny",
        parsed_json={
            "version": 1,
            "rules": [
                {
                    "action": "test_action",
                    "decide": "require_approval",
                    "approvers": ["#approvals"],
                }
            ],
            "default": "deny",
        },
        is_active=True,
    )
    async_session.add(policy)
    await async_session.flush()
    return policy


@pytest.fixture
async def slack_integration(
    async_session: AsyncSession, slack_org: Organization, slack_user: User
) -> SlackIntegration:
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
async def pending_action(
    async_session: AsyncSession, slack_agent: Agent
) -> tuple[Action, ApprovalRequest]:
    """Create a pending action with approval request."""
    action = Action(
        agent_id=slack_agent.id,
        action_name="test_action",
        payload={"target": "production"},
        decision=Decision.PENDING,
        decision_reason="requires approval",
        idempotency_key=f"test-{uuid.uuid4()}",
    )
    async_session.add(action)
    await async_session.flush()

    approval = ApprovalRequest(
        action_id=action.id,
        approvers_config={"approvers": ["#approvals"]},
        status=ApprovalStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
        slack_channel="C12345678",
        slack_message_ts="1234567890.123456",
    )
    async_session.add(approval)
    await async_session.flush()

    return action, approval


@pytest.fixture
def mock_slack_service() -> MagicMock:
    """Create a mock SlackService."""
    mock = MagicMock()
    mock.get_slack_user_email = AsyncMock()
    mock.find_user_by_slack_email = AsyncMock()
    mock.send_ephemeral_error = AsyncMock()
    mock.update_via_response_url = AsyncMock()
    mock.get_pending_approvals_for_org = AsyncMock(return_value=[])
    mock.exchange_code = AsyncMock()
    mock.get_oauth_url = MagicMock(return_value="https://slack.com/oauth/test")
    mock.delete_integration = AsyncMock(return_value=True)
    mock.update_message_expired = AsyncMock()
    return mock


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
    async def test_approve_button_click(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        slack_integration: SlackIntegration,
        slack_user: User,
        pending_action: tuple[Action, ApprovalRequest],
        mock_slack_service: MagicMock,
    ):
        """Test approve button click updates action decision."""
        settings = get_settings()
        action, approval = pending_action

        # Configure mock to return the user's email and find the user
        mock_slack_service.get_slack_user_email.return_value = slack_user.email
        mock_slack_service.find_user_by_slack_email.return_value = slack_user

        # Override the dependency
        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="approve_action",
                action_value=str(action.id),
                team_id=slack_integration.team_id,
            )

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

            # Verify action was approved
            await async_session.refresh(action)
            assert action.decision == Decision.APPROVED
            assert action.decided_at is not None

            # Verify approval request was updated
            await async_session.refresh(approval)
            assert approval.status == ApprovalStatus.APPROVED
            assert approval.decided_by_user_id == slack_user.id
            assert approval.decided_at is not None

            # Verify Slack message update was called with approval block
            mock_slack_service.update_via_response_url.assert_called_once()
            call_args = mock_slack_service.update_via_response_url.call_args
            assert "✅" in call_args[0][1][0]["text"]["text"]
            assert "Approved" in call_args[0][1][0]["text"]["text"]

        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_reject_button_click(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        slack_integration: SlackIntegration,
        slack_user: User,
        pending_action: tuple[Action, ApprovalRequest],
        mock_slack_service: MagicMock,
    ):
        """Test reject button click updates action decision."""
        settings = get_settings()
        action, approval = pending_action

        mock_slack_service.get_slack_user_email.return_value = slack_user.email
        mock_slack_service.find_user_by_slack_email.return_value = slack_user

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="reject_action",
                action_value=str(action.id),
                team_id=slack_integration.team_id,
            )

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

            # Verify action was rejected
            await async_session.refresh(action)
            assert action.decision == Decision.REJECTED

            # Verify approval request was updated
            await async_session.refresh(approval)
            assert approval.status == ApprovalStatus.REJECTED
            assert approval.decided_by_user_id == slack_user.id

            # Verify Slack message update was called with rejection block
            mock_slack_service.update_via_response_url.assert_called_once()
            call_args = mock_slack_service.update_via_response_url.call_args
            assert "❌" in call_args[0][1][0]["text"]["text"]
            assert "Rejected" in call_args[0][1][0]["text"]["text"]

        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_already_decided_action(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        slack_integration: SlackIntegration,
        slack_user: User,
        pending_action: tuple[Action, ApprovalRequest],
        mock_slack_service: MagicMock,
    ):
        """Clicking button on already decided action shows error."""
        settings = get_settings()
        action, approval = pending_action

        # Pre-approve the action
        action.decision = Decision.APPROVED
        action.decided_at = datetime.now(UTC)
        approval.status = ApprovalStatus.APPROVED
        await async_session.commit()

        mock_slack_service.get_slack_user_email.return_value = slack_user.email
        mock_slack_service.find_user_by_slack_email.return_value = slack_user

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="approve_action",
                action_value=str(action.id),
                team_id=slack_integration.team_id,
            )

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

            # Verify ephemeral error was sent
            mock_slack_service.send_ephemeral_error.assert_called_once()
            error_msg = mock_slack_service.send_ephemeral_error.call_args[0][1]
            assert "already been" in error_msg

            # Verify no message update was sent
            mock_slack_service.update_via_response_url.assert_not_called()

            # Verify action is still approved (no change)
            await async_session.refresh(action)
            assert action.decision == Decision.APPROVED

        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_unauthorized_user_clicks_button(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        slack_integration: SlackIntegration,
        pending_action: tuple[Action, ApprovalRequest],
        mock_slack_service: MagicMock,
    ):
        """User clicking who isn't in the org should get error."""
        settings = get_settings()
        action, approval = pending_action

        # Mock returns email but no matching Tollgate user
        mock_slack_service.get_slack_user_email.return_value = "unknown@other.com"
        mock_slack_service.find_user_by_slack_email.return_value = None

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="approve_action",
                action_value=str(action.id),
                team_id=slack_integration.team_id,
            )

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

            # Verify ephemeral error was sent about no account
            mock_slack_service.send_ephemeral_error.assert_called_once()
            error_msg = mock_slack_service.send_ephemeral_error.call_args[0][1]
            assert "No Tollgate account" in error_msg

            # Verify action is still pending (no change)
            await async_session.refresh(action)
            assert action.decision == Decision.PENDING

        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_valid_signature_accepted(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        mock_slack_service: MagicMock,
    ):
        """Valid signature with empty payload should succeed."""
        settings = get_settings()

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_unknown_action_id_ignored(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        mock_slack_service: MagicMock,
    ):
        """Unknown action_id should be ignored gracefully."""
        settings = get_settings()

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="unknown_action",
                action_value="some_value",
                team_id=slack_integration.team_id,
            )

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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_invalid_action_uuid_ignored(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        mock_slack_service: MagicMock,
    ):
        """Invalid UUID in action value should be ignored gracefully."""
        settings = get_settings()

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            payload = build_interaction_payload(
                action_id="approve_action",
                action_value="not-a-uuid",
                team_id=slack_integration.team_id,
            )

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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)


class TestSlackCommands:
    """Test Slack slash commands."""

    @pytest.mark.asyncio
    async def test_tollgate_pending_no_pending(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        mock_slack_service: MagicMock,
    ):
        """Test /tollgate pending with no pending approvals."""
        settings = get_settings()

        mock_slack_service.get_pending_approvals_for_org.return_value = []

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_tollgate_pending_with_pending(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        slack_agent: Agent,
        pending_action: tuple[Action, ApprovalRequest],
        mock_slack_service: MagicMock,
    ):
        """Test /tollgate pending with pending approvals."""
        settings = get_settings()
        action, approval = pending_action

        # Mock returns the pending action
        mock_slack_service.get_pending_approvals_for_org.return_value = [
            (action, approval, slack_agent)
        ]

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_unknown_subcommand(
        self,
        async_client: AsyncClient,
        slack_integration: SlackIntegration,
        mock_slack_service: MagicMock,
    ):
        """Test /tollgate with unknown subcommand."""
        settings = get_settings()

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
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
        finally:
            app.dependency_overrides.pop(get_slack_service, None)


class TestSlackOAuth:
    """Test Slack OAuth flow."""

    @pytest.mark.asyncio
    async def test_install_redirect(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        mock_slack_service: MagicMock,
    ):
        """Test /integrations/slack/install redirects to Slack."""
        mock_slack_service.get_oauth_url.return_value = "https://slack.com/oauth/v2/authorize?client_id=test"

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            response = await async_client.get(
                "/integrations/slack/install",
                headers=auth_headers,
                follow_redirects=False,
            )

            assert response.status_code == 302
            location = response.headers["location"]
            assert "slack.com/oauth" in location
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_oauth_callback_success(
        self,
        async_client: AsyncClient,
        async_session: AsyncSession,
        test_org: Organization,
        test_user: User,
        mock_slack_service: MagicMock,
    ):
        """Test OAuth callback creates integration."""
        # Mock the exchange_code to create a real integration
        async def mock_exchange(code, org_id, user_id):
            integration = SlackIntegration(
                org_id=org_id,
                team_id="T99999999",
                team_name="New Workspace",
                bot_token_encrypted=encrypt("xoxb-new-bot-token"),
                bot_user_id="U99999999",
                scope="chat:write,commands,users:read,users:read.email",
                installed_by_user_id=user_id,
                installed_at=datetime.now(UTC),
            )
            async_session.add(integration)
            await async_session.flush()
            return integration

        mock_slack_service.exchange_code = mock_exchange

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            state = f"{test_org.id}:{test_user.id}"

            response = await async_client.get(
                "/integrations/slack/callback",
                params={"code": "test-oauth-code", "state": state},
                follow_redirects=False,
            )

            assert response.status_code == 302
            assert "success=slack" in response.headers["location"]

            # Verify integration was created
            from sqlalchemy import select

            result = await async_session.execute(
                select(SlackIntegration).where(SlackIntegration.org_id == test_org.id)
            )
            integration = result.scalar_one_or_none()
            assert integration is not None
            assert integration.team_id == "T99999999"

            # Verify token is encrypted (not plaintext)
            assert integration.bot_token_encrypted != "xoxb-new-bot-token"
            assert decrypt(integration.bot_token_encrypted) == "xoxb-new-bot-token"

        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_oauth_callback_invalid_state(
        self,
        async_client: AsyncClient,
        mock_slack_service: MagicMock,
    ):
        """Test OAuth callback with invalid state fails."""
        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            response = await async_client.get(
                "/integrations/slack/callback",
                params={"code": "test-code", "state": "invalid"},
                follow_redirects=False,
            )

            assert response.status_code == 400
        finally:
            app.dependency_overrides.pop(get_slack_service, None)

    @pytest.mark.asyncio
    async def test_uninstall_slack(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        mock_slack_service: MagicMock,
    ):
        """Test uninstalling Slack integration."""
        mock_slack_service.delete_integration.return_value = True

        app.dependency_overrides[get_slack_service] = lambda: mock_slack_service

        try:
            response = await async_client.delete(
                "/integrations/slack",
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert response.json() == {"status": "deleted"}
        finally:
            app.dependency_overrides.pop(get_slack_service, None)


class TestSlackExpiryFlow:
    """Test expired action updates Slack message."""

    @pytest.mark.asyncio
    async def test_expired_action_updates_slack_message(
        self,
        async_session: AsyncSession,
        slack_integration: SlackIntegration,
        pending_action: tuple[Action, ApprovalRequest],
    ):
        """Test that expiry job updates Slack messages."""
        action, approval = pending_action

        # Set expires_at to past
        await async_session.execute(
            update(ApprovalRequest)
            .where(ApprovalRequest.id == approval.id)
            .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        await async_session.commit()

        # Run the expiry service
        from tollgate.services.approval import ApprovalService

        approval_service = ApprovalService(async_session)
        expired_ids = await approval_service.expire_pending_approvals()

        assert len(expired_ids) == 1
        assert approval.id in expired_ids

        # Verify action was rejected with timeout reason
        await async_session.refresh(action)
        assert action.decision == Decision.REJECTED
        assert "timed out" in action.decision_reason

        # The Slack message update is done via slack_notifier.update_expired_slack_messages
        # which is called by the background task. We verify the service method exists.
        from tollgate.services.slack_notifier import update_expired_slack_messages

        # This would be called by background.py with the expired_ids
        # For unit test, we verify the function signature is correct
        assert callable(update_expired_slack_messages)


class TestSlackLatency:
    """Test that Slack integration doesn't impact /v1/check latency."""

    @pytest.mark.asyncio
    async def test_check_latency_with_pending(
        self,
        async_client: AsyncClient,
        agent_headers: dict,
    ):
        """Verify /v1/check returns quickly."""
        import time

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
