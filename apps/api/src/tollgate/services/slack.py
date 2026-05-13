"""Slack integration service."""

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from slack_sdk.errors import SlackApiError
from slack_sdk.web.async_client import AsyncWebClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.config import get_settings
from tollgate.encryption import decrypt, encrypt
from tollgate.logging import get_logger
from tollgate.models import (
    Action,
    Agent,
    ApprovalRequest,
    Organization,
    SlackIntegration,
    User,
)

logger = get_logger(__name__)


class SlackError(Exception):
    """Base Slack error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class SlackService:
    """Service for Slack operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._settings = get_settings()

    def get_oauth_url(self, state: str) -> str:
        """Generate Slack OAuth authorization URL."""
        from urllib.parse import urljoin

        scopes = "chat:write,chat:write.public,users:read,users:read.email,commands,im:write"
        base_url = self._settings.public_base_url.rstrip("/")
        redirect_uri = f"{base_url}/integrations/slack/callback"

        return (
            f"https://slack.com/oauth/v2/authorize"
            f"?client_id={self._settings.slack_client_id}"
            f"&scope={scopes}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code(
        self,
        code: str,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> SlackIntegration:
        """Exchange OAuth code for access token and store integration."""
        client = AsyncWebClient()

        base_url = self._settings.public_base_url.rstrip("/")
        redirect_uri = f"{base_url}/integrations/slack/callback"

        try:
            response = await client.oauth_v2_access(
                client_id=self._settings.slack_client_id,
                client_secret=self._settings.slack_client_secret,
                code=code,
                redirect_uri=redirect_uri,
            )
        except SlackApiError as e:
            logger.error(
                "slack_oauth_failed",
                error=str(e),
                org_id=str(org_id),
            )
            raise SlackError("OAUTH_FAILED", f"Failed to exchange code: {e}")

        # Extract data from response
        team_id = response["team"]["id"]
        team_name = response["team"]["name"]
        bot_token = response["access_token"]
        bot_user_id = response["bot_user_id"]
        scope = response["scope"]

        # Encrypt the bot token
        encrypted_token = encrypt(bot_token)

        # Check if this Slack workspace is already claimed by a different org
        team_result = await self.session.execute(
            select(SlackIntegration).where(SlackIntegration.team_id == team_id)
        )
        team_existing = team_result.scalar_one_or_none()
        if team_existing and team_existing.org_id != org_id:
            raise SlackError("WORKSPACE_TAKEN", "This Slack workspace is already connected to another Tollgate account.")

        # Check if integration already exists for this org
        result = await self.session.execute(
            select(SlackIntegration).where(SlackIntegration.org_id == org_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing integration
            existing.team_id = team_id
            existing.team_name = team_name
            existing.bot_token_encrypted = encrypted_token
            existing.bot_user_id = bot_user_id
            existing.scope = scope
            existing.installed_by_user_id = user_id
            existing.installed_at = datetime.now(UTC)
            integration = existing
        else:
            # Create new integration
            integration = SlackIntegration(
                org_id=org_id,
                team_id=team_id,
                team_name=team_name,
                bot_token_encrypted=encrypted_token,
                bot_user_id=bot_user_id,
                scope=scope,
                installed_by_user_id=user_id,
                installed_at=datetime.now(UTC),
            )
            self.session.add(integration)

        await self.session.flush()

        logger.info(
            "slack_integration_created",
            org_id=str(org_id),
            team_id=team_id,
            team_name=team_name,
        )

        return integration

    async def get_integration(self, org_id: uuid.UUID) -> SlackIntegration | None:
        """Get Slack integration for an organization."""
        result = await self.session.execute(
            select(SlackIntegration).where(SlackIntegration.org_id == org_id)
        )
        return result.scalar_one_or_none()

    async def delete_integration(self, org_id: uuid.UUID) -> bool:
        """Delete Slack integration for an organization."""
        integration = await self.get_integration(org_id)
        if not integration:
            return False

        await self.session.delete(integration)
        await self.session.flush()

        logger.info(
            "slack_integration_deleted",
            org_id=str(org_id),
            team_id=integration.team_id,
        )

        return True

    def _get_client(self, integration: SlackIntegration) -> AsyncWebClient:
        """Get an authenticated Slack client."""
        token = decrypt(integration.bot_token_encrypted)
        return AsyncWebClient(token=token)

    async def _resolve_user_id(
        self,
        client: AsyncWebClient,
        approver: str,
    ) -> str | None:
        """Resolve @username or email to Slack user ID."""
        if approver.startswith("@"):
            # Remove @ prefix
            username = approver[1:]
            try:
                # Try to find user by email first (more reliable)
                # Note: users:read.email scope required
                response = await client.users_list()
                for member in response.get("members", []):
                    profile = member.get("profile", {})
                    if (
                        profile.get("display_name") == username
                        or member.get("name") == username
                        or profile.get("real_name", "").lower() == username.lower()
                    ):
                        return member["id"]
            except SlackApiError:
                pass
        return None

    async def send_approval_request(
        self,
        integration: SlackIntegration,
        action: Action,
        agent: Agent,
        approvers: list[str],
        rule_reason: str,
        expires_at: datetime,
    ) -> tuple[str, str] | None:
        """Send approval request message to Slack.

        Returns (channel, message_ts) if successful, None otherwise.
        """
        client = self._get_client(integration)

        # Build the Block Kit message
        expires_in_minutes = max(
            0, int((expires_at - datetime.now(UTC)).total_seconds() // 60)
        )

        payload_str = json.dumps(action.payload, indent=2)

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🔔 Approval Required",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Agent:*\n{agent.name}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Action:*\n`{action.action_name}`",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Payload:*\n```{payload_str}```",
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Rule:*\n{rule_reason}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Approvers:*\n{', '.join(approvers)}",
                    },
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"⏱ Expires in {expires_in_minutes} minutes | Action ID: `{action.id}`",
                    },
                ],
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "✅ Approve",
                            "emoji": True,
                        },
                        "style": "primary",
                        "value": str(action.id),
                        "action_id": "approve_action",
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "❌ Reject",
                            "emoji": True,
                        },
                        "style": "danger",
                        "value": str(action.id),
                        "action_id": "reject_action",
                    },
                ],
            },
        ]

        # Determine where to send the message
        channel: str | None = None
        for approver in approvers:
            if approver.startswith("#"):
                # Post to channel
                channel = approver[1:]  # Remove # prefix
                break
            elif approver.startswith("@"):
                # DM the user
                user_id = await self._resolve_user_id(client, approver)
                if user_id:
                    try:
                        # Open a DM channel
                        conv_response = await client.conversations_open(users=[user_id])
                        channel = conv_response["channel"]["id"]
                        break
                    except SlackApiError:
                        continue

        if not channel:
            logger.warning(
                "slack_no_valid_channel",
                action_id=str(action.id),
                approvers=approvers,
            )
            return None

        try:
            response = await client.chat_postMessage(
                channel=channel,
                blocks=blocks,
                text=f"Approval required for action: {action.action_name}",
            )

            message_ts = response["ts"]
            channel_id = response["channel"]

            logger.info(
                "slack_approval_sent",
                action_id=str(action.id),
                channel=channel_id,
                message_ts=message_ts,
            )

            return (channel_id, message_ts)

        except SlackApiError as e:
            logger.error(
                "slack_send_failed",
                action_id=str(action.id),
                channel=channel,
                error=str(e),
            )
            return None

    async def update_message_approved(
        self,
        integration: SlackIntegration,
        channel: str,
        message_ts: str,
        approver_name: str,
    ) -> None:
        """Update Slack message to show approval."""
        client = self._get_client(integration)
        now = datetime.now(UTC).strftime("%H:%M UTC")

        try:
            await client.chat_update(
                channel=channel,
                ts=message_ts,
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"✅ *Approved* by @{approver_name} at {now}",
                        },
                    },
                ],
                text=f"Approved by {approver_name}",
            )
        except SlackApiError as e:
            logger.error(
                "slack_update_failed",
                channel=channel,
                message_ts=message_ts,
                error=str(e),
            )

    async def update_message_rejected(
        self,
        integration: SlackIntegration,
        channel: str,
        message_ts: str,
        rejector_name: str,
    ) -> None:
        """Update Slack message to show rejection."""
        client = self._get_client(integration)
        now = datetime.now(UTC).strftime("%H:%M UTC")

        try:
            await client.chat_update(
                channel=channel,
                ts=message_ts,
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"❌ *Rejected* by @{rejector_name} at {now}",
                        },
                    },
                ],
                text=f"Rejected by {rejector_name}",
            )
        except SlackApiError as e:
            logger.error(
                "slack_update_failed",
                channel=channel,
                message_ts=message_ts,
                error=str(e),
            )

    async def update_message_expired(
        self,
        integration: SlackIntegration,
        channel: str,
        message_ts: str,
    ) -> None:
        """Update Slack message to show expiration."""
        client = self._get_client(integration)

        try:
            await client.chat_update(
                channel=channel,
                ts=message_ts,
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "⏱ *Expired* — no decision in 5 minutes",
                        },
                    },
                ],
                text="Approval request expired",
            )
        except SlackApiError as e:
            logger.error(
                "slack_update_failed",
                channel=channel,
                message_ts=message_ts,
                error=str(e),
            )

    async def send_ephemeral_error(
        self,
        response_url: str,
        message: str,
    ) -> None:
        """Send an ephemeral error message via response_url."""
        import aiohttp

        async with aiohttp.ClientSession() as http_client:
            try:
                await http_client.post(
                    response_url,
                    json={
                        "response_type": "ephemeral",
                        "text": message,
                    },
                )
            except Exception as e:
                logger.error("slack_ephemeral_failed", error=str(e))

    async def update_via_response_url(
        self,
        response_url: str,
        blocks: list[dict[str, Any]],
        text: str,
    ) -> None:
        """Update message via response_url (works even for old messages)."""
        import aiohttp

        async with aiohttp.ClientSession() as http_client:
            try:
                await http_client.post(
                    response_url,
                    json={
                        "replace_original": True,
                        "blocks": blocks,
                        "text": text,
                    },
                )
            except Exception as e:
                logger.error("slack_response_url_failed", error=str(e))

    async def get_pending_approvals_for_org(
        self,
        org_id: uuid.UUID,
    ) -> list[tuple[Action, ApprovalRequest, Agent]]:
        """Get all pending approvals for an organization."""
        from tollgate.models import Decision

        result = await self.session.execute(
            select(Action, ApprovalRequest, Agent)
            .join(ApprovalRequest, Action.id == ApprovalRequest.action_id)
            .join(Agent, Action.agent_id == Agent.id)
            .where(
                Agent.org_id == org_id,
                Action.decision == Decision.PENDING,
            )
            .order_by(ApprovalRequest.created_at.desc())
        )
        return list(result.all())

    async def find_user_by_slack_email(
        self,
        slack_email: str,
        org_id: uuid.UUID,
    ) -> User | None:
        """Find a Tollgate user by their Slack email in the given org."""
        result = await self.session.execute(
            select(User).where(
                User.email == slack_email,
                User.org_id == org_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_slack_user_email(
        self,
        integration: SlackIntegration,
        slack_user_id: str,
    ) -> str | None:
        """Get a Slack user's email address.

        Args:
            integration: The Slack integration with bot token
            slack_user_id: The Slack user ID (e.g., U12345678)

        Returns:
            The user's email address, or None if not found
        """
        client = self._get_client(integration)

        try:
            user_info = await client.users_info(user=slack_user_id)
            return user_info.get("user", {}).get("profile", {}).get("email")
        except SlackApiError as e:
            logger.error(
                "slack_user_lookup_failed",
                slack_user_id=slack_user_id,
                error=str(e),
            )
            return None
