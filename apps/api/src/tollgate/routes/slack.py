"""Slack integration routes."""

import hashlib
import hmac
import json
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.config import get_settings
from tollgate.dependencies import AuthenticatedUser, DBSession, SlackServiceDep
from tollgate.logging import get_logger
from tollgate.models import Action, Agent, ApprovalRequest, ApprovalStatus, Decision
from tollgate.services.approval import ApprovalService
from tollgate.services.slack import SlackError, SlackService

logger = get_logger(__name__)

router = APIRouter(prefix="/integrations/slack", tags=["slack"])


class SlackIntegrationResponse(BaseModel):
    """Response for Slack integration info."""

    id: str
    team_id: str
    team_name: str
    installed_at: datetime


# OAuth Routes


@router.get("", response_model=SlackIntegrationResponse | None)
async def get_slack_integration(
    current_user: AuthenticatedUser,
    slack_service: SlackServiceDep,
) -> SlackIntegrationResponse | None:
    """Get current Slack integration status for the org."""
    integration = await slack_service.get_integration(current_user.org_id)
    if not integration:
        return None
    return SlackIntegrationResponse(
        id=str(integration.id),
        team_id=integration.team_id,
        team_name=integration.team_name,
        installed_at=integration.installed_at,
    )


@router.get("/connect-url")
async def get_connect_url(
    current_user: AuthenticatedUser,
    slack_service: SlackServiceDep,
) -> dict[str, str]:
    """Return the Slack OAuth URL so the frontend can redirect."""
    state = f"{current_user.org_id}:{current_user.id}"
    return {"url": slack_service.get_oauth_url(state)}


@router.get("/install")
async def install_slack(
    current_user: AuthenticatedUser,
    slack_service: SlackServiceDep,
) -> RedirectResponse:
    """Redirect to Slack OAuth flow."""
    state = f"{current_user.org_id}:{current_user.id}"
    oauth_url = slack_service.get_oauth_url(state)
    return RedirectResponse(url=oauth_url, status_code=302)


@router.get("/callback")
async def slack_callback(
    code: str,
    state: str,
    slack_service: SlackServiceDep,
) -> RedirectResponse:
    """Handle Slack OAuth callback."""
    settings = get_settings()

    # Parse state to get org_id and user_id
    try:
        org_id_str, user_id_str = state.split(":")
        org_id = uuid.UUID(org_id_str)
        user_id = uuid.UUID(user_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_STATE", "message": "Invalid OAuth state"}},
        )

    try:
        await slack_service.exchange_code(code, org_id, user_id)
    except SlackError as e:
        logger.error("slack_oauth_callback_failed", error=e.message, org_id=str(org_id))
        # Redirect to dashboard with error
        return RedirectResponse(
            url=f"{settings.dashboard_url}/settings?tab=slack&error=slack_failed",
            status_code=302,
        )

    return RedirectResponse(
        url=f"{settings.dashboard_url}/settings?tab=slack&success=slack",
        status_code=302,
    )


@router.delete("")
async def uninstall_slack(
    current_user: AuthenticatedUser,
    slack_service: SlackServiceDep,
) -> dict[str, str]:
    """Uninstall Slack integration."""
    deleted = await slack_service.delete_integration(current_user.org_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "No Slack integration found"}},
        )

    return {"status": "deleted"}


# Signature Verification


def verify_slack_signature(
    request_body: bytes,
    timestamp: str,
    signature: str,
) -> bool:
    """Verify Slack request signature."""
    settings = get_settings()
    if not settings.slack_signing_secret:
        return False

    # Check timestamp to prevent replay attacks (5 minute window)
    try:
        request_timestamp = int(timestamp)
        current_time = int(time.time())
        if abs(current_time - request_timestamp) > 300:  # 5 minutes
            return False
    except ValueError:
        return False

    # Compute expected signature
    sig_basestring = f"v0:{timestamp}:{request_body.decode()}"
    expected_sig = (
        "v0="
        + hmac.new(
            settings.slack_signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256,
        ).hexdigest()
    )

    return hmac.compare_digest(expected_sig, signature)


async def get_verified_slack_body(
    request: Request,
    x_slack_request_timestamp: Annotated[str | None, Header()] = None,
    x_slack_signature: Annotated[str | None, Header()] = None,
) -> bytes:
    """Dependency that verifies Slack signature and returns body."""
    if not x_slack_request_timestamp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Slack-Request-Timestamp header",
        )
    if not x_slack_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Slack-Signature header",
        )

    body = await request.body()

    if not verify_slack_signature(body, x_slack_request_timestamp, x_slack_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Slack signature",
        )

    return body


VerifiedSlackBody = Annotated[bytes, Depends(get_verified_slack_body)]


# Interactivity Endpoint


@router.post("/interactions")
async def handle_interaction(
    body: VerifiedSlackBody,
    session: DBSession,
    slack_service: SlackServiceDep,
) -> dict[str, Any]:
    """Handle Slack interactive component callbacks (button clicks)."""
    # Slack sends payload as form-encoded
    from urllib.parse import parse_qs

    parsed = parse_qs(body.decode())
    payload_str = parsed.get("payload", [""])[0]
    if not payload_str:
        return {"ok": True}

    payload = json.loads(payload_str)

    # Handle different interaction types
    if payload.get("type") == "block_actions":
        return await handle_block_action(payload, session, slack_service)

    return {"ok": True}


async def handle_block_action(
    payload: dict[str, Any],
    session: AsyncSession,
    slack_service: SlackService,
) -> dict[str, Any]:
    """Handle block action (button click)."""
    actions = payload.get("actions", [])
    if not actions:
        return {"ok": True}

    action = actions[0]
    action_id = action.get("action_id")
    action_value = action.get("value")  # This is the Tollgate action UUID
    response_url = payload.get("response_url", "")
    slack_user = payload.get("user", {})
    slack_user_id = slack_user.get("id", "")
    team_id = payload.get("team", {}).get("id", "")

    logger.info(
        "slack_button_clicked",
        action_id=action_id,
        tollgate_action_id=action_value,
        slack_user_id=slack_user_id,
    )

    if action_id not in ("approve_action", "reject_action"):
        return {"ok": True}

    # Parse Tollgate action UUID
    try:
        tollgate_action_id = uuid.UUID(action_value)
    except (ValueError, TypeError):
        return {"ok": True}

    # Get the Slack integration to find the org
    from tollgate.models import SlackIntegration

    integration_result = await session.execute(
        select(SlackIntegration).where(SlackIntegration.team_id == team_id)
    )
    integration = integration_result.scalar_one_or_none()
    if not integration:
        return {"ok": True}

    # Get the Slack user's email via the service
    slack_email = await slack_service.get_slack_user_email(integration, slack_user_id)

    if not slack_email:
        await slack_service.send_ephemeral_error(
            response_url,
            "❌ Could not verify your identity. Please try again.",
        )
        return {"ok": True}

    # Get the action and approval request
    action_result = await session.execute(
        select(Action, ApprovalRequest, Agent)
        .join(ApprovalRequest, Action.id == ApprovalRequest.action_id)
        .join(Agent, Action.agent_id == Agent.id)
        .where(Action.id == tollgate_action_id)
    )
    row = action_result.first()

    if not row:
        await slack_service.send_ephemeral_error(
            response_url,
            "❌ Action not found.",
        )
        return {"ok": True}

    tollgate_action, approval_request, agent = row

    # Verify the action belongs to this workspace's org
    if agent.org_id != integration.org_id:
        await slack_service.send_ephemeral_error(
            response_url,
            "❌ You don't have permission to approve actions for this organization.",
        )
        return {"ok": True}

    # Check if already decided
    if tollgate_action.decision != Decision.PENDING:
        await slack_service.send_ephemeral_error(
            response_url,
            f"⚠️ This action has already been {tollgate_action.decision.value}.",
        )
        return {"ok": True}

    # Check if expired
    if approval_request.expires_at < datetime.now(UTC):
        await slack_service.send_ephemeral_error(
            response_url,
            "⏱ This approval request has expired.",
        )
        return {"ok": True}

    # Process the decision
    approval_service = ApprovalService(session)
    decision = "approved" if action_id == "approve_action" else "rejected"

    try:
        await approval_service.decide_approval(
            action_id=tollgate_action_id,
            decision=decision,
            decided_by_user_id=None,
        )
    except Exception as e:
        logger.error("slack_decision_failed", error=str(e))
        await slack_service.send_ephemeral_error(
            response_url,
            "❌ Failed to process decision. Please try again.",
        )
        return {"ok": True}

    # Update the Slack message via response_url
    now = datetime.now(UTC).strftime("%H:%M UTC")
    user_display = slack_user.get("name") or (slack_email.split("@")[0] if slack_email else slack_user_id)

    if decision == "approved":
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"✅ *Approved* by @{user_display} at {now}",
                },
            },
        ]
        text = f"Approved by {user_display}"
    else:
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"❌ *Rejected* by @{user_display} at {now}",
                },
            },
        ]
        text = f"Rejected by {user_display}"

    await slack_service.update_via_response_url(response_url, blocks, text)

    logger.info(
        "slack_action_decided",
        action_id=str(tollgate_action_id),
        decision=decision,
        slack_user_id=slack_user_id,
        slack_email=slack_email,
    )

    return {"ok": True}


# Slash Commands


@router.post("/commands")
async def handle_command(
    body: VerifiedSlackBody,
    session: DBSession,
    slack_service: SlackServiceDep,
) -> dict[str, Any]:
    """Handle Slack slash commands."""
    from urllib.parse import parse_qs

    parsed = parse_qs(body.decode())

    command = parsed.get("command", [""])[0]
    text = parsed.get("text", [""])[0].strip()
    team_id = parsed.get("team_id", [""])[0]
    user_id = parsed.get("user_id", [""])[0]
    response_url = parsed.get("response_url", [""])[0]

    logger.info(
        "slack_command_received",
        command=command,
        text=text,
        team_id=team_id,
    )

    if command != "/tollgate":
        return {"text": "Unknown command"}

    # Get the integration
    from tollgate.models import SlackIntegration

    integration_result = await session.execute(
        select(SlackIntegration).where(SlackIntegration.team_id == team_id)
    )
    integration = integration_result.scalar_one_or_none()

    if not integration:
        return {
            "response_type": "ephemeral",
            "text": "❌ Tollgate is not connected to this workspace. Ask an admin to install it.",
        }

    if text == "pending" or text == "":
        return await handle_pending_command(integration, slack_service)

    return {
        "response_type": "ephemeral",
        "text": f"Unknown subcommand: `{text}`\n\nUsage:\n• `/tollgate pending` - List pending approvals",
    }


async def handle_pending_command(
    integration: "SlackIntegration",
    slack_service: SlackService,
) -> dict[str, Any]:
    """Handle /tollgate pending command."""
    pending = await slack_service.get_pending_approvals_for_org(integration.org_id)

    if not pending:
        return {
            "response_type": "ephemeral",
            "text": "✅ No pending approvals right now.",
        }

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📋 Pending Approvals ({len(pending)})",
                "emoji": True,
            },
        },
    ]

    for action, approval_request, agent in pending[:10]:  # Limit to 10
        expires_in = max(
            0,
            int((approval_request.expires_at - datetime.now(UTC)).total_seconds() // 60),
        )

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{agent.name}* → `{action.action_name}`\nExpires in {expires_in} min",
            },
            "accessory": {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View",
                    "emoji": True,
                },
                "value": str(action.id),
                "action_id": "view_pending",
            },
        })

        blocks.append({
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
        })

        blocks.append({"type": "divider"})

    if len(pending) > 10:
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"_Showing 10 of {len(pending)} pending approvals_",
                },
            ],
        })

    return {
        "response_type": "ephemeral",
        "blocks": blocks,
    }
