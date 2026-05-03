"""Slack notification helper for fire-and-forget approval messages.

This module provides async functions that can be called via
asyncio.create_task() to send Slack notifications without blocking
the API response.
"""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.database import get_session_context
from tollgate.logging import get_logger
from tollgate.models import Action, Agent, ApprovalRequest, SlackIntegration
from tollgate.services.slack import SlackService

logger = get_logger(__name__)


async def notify_approval_required(
    action_id: uuid.UUID,
    agent_id: uuid.UUID,
    approvers: list[str],
    rule_reason: str,
    expires_at: datetime,
) -> None:
    """Send Slack notification for a pending approval (fire-and-forget).

    This function is designed to be called via asyncio.create_task()
    and should not raise exceptions to the caller.
    """
    try:
        async with get_session_context() as session:
            # Get the action and agent
            action_result = await session.execute(
                select(Action).where(Action.id == action_id)
            )
            action = action_result.scalar_one_or_none()
            if not action:
                logger.error("slack_notify_action_not_found", action_id=str(action_id))
                return

            agent_result = await session.execute(
                select(Agent).where(Agent.id == agent_id)
            )
            agent = agent_result.scalar_one_or_none()
            if not agent:
                logger.error("slack_notify_agent_not_found", agent_id=str(agent_id))
                return

            # Get the Slack integration for this org
            integration_result = await session.execute(
                select(SlackIntegration).where(
                    SlackIntegration.org_id == agent.org_id
                )
            )
            integration = integration_result.scalar_one_or_none()
            if not integration:
                logger.debug(
                    "slack_no_integration",
                    org_id=str(agent.org_id),
                    action_id=str(action_id),
                )
                return

            # Send the Slack message
            slack_service = SlackService(session)
            result = await slack_service.send_approval_request(
                integration=integration,
                action=action,
                agent=agent,
                approvers=approvers,
                rule_reason=rule_reason,
                expires_at=expires_at,
            )

            if result:
                channel, message_ts = result
                # Update the approval_request with Slack info
                await session.execute(
                    update(ApprovalRequest)
                    .where(ApprovalRequest.action_id == action_id)
                    .values(slack_channel=channel, slack_message_ts=message_ts)
                )
                await session.commit()

                logger.info(
                    "slack_notification_sent",
                    action_id=str(action_id),
                    channel=channel,
                    message_ts=message_ts,
                )
            else:
                logger.warning(
                    "slack_notification_failed",
                    action_id=str(action_id),
                )

    except Exception as e:
        # Log but don't raise - this is fire-and-forget
        logger.error(
            "slack_notify_error",
            action_id=str(action_id),
            error=str(e),
            exc_info=True,
        )


async def update_expired_slack_messages(
    expired_approval_ids: list[uuid.UUID],
) -> None:
    """Update Slack messages for expired approvals (fire-and-forget)."""
    if not expired_approval_ids:
        return

    try:
        async with get_session_context() as session:
            # Get approval requests with Slack info
            result = await session.execute(
                select(ApprovalRequest, Agent)
                .join(Action, ApprovalRequest.action_id == Action.id)
                .join(Agent, Action.agent_id == Agent.id)
                .where(
                    ApprovalRequest.id.in_(expired_approval_ids),
                    ApprovalRequest.slack_channel.isnot(None),
                    ApprovalRequest.slack_message_ts.isnot(None),
                )
            )
            rows = result.all()

            for approval_request, agent in rows:
                # Get integration
                integration_result = await session.execute(
                    select(SlackIntegration).where(
                        SlackIntegration.org_id == agent.org_id
                    )
                )
                integration = integration_result.scalar_one_or_none()
                if not integration:
                    continue

                slack_service = SlackService(session)
                await slack_service.update_message_expired(
                    integration=integration,
                    channel=approval_request.slack_channel,  # type: ignore
                    message_ts=approval_request.slack_message_ts,  # type: ignore
                )

                logger.info(
                    "slack_expiry_message_updated",
                    approval_id=str(approval_request.id),
                    channel=approval_request.slack_channel,
                )

    except Exception as e:
        logger.error(
            "slack_expiry_update_error",
            error=str(e),
            exc_info=True,
        )
