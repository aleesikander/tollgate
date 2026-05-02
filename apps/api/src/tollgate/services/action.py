"""Action service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.logging import get_logger
from tollgate.models import Action, Decision

logger = get_logger(__name__)


class ActionService:
    """Service for action/check operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def check_action(
        self,
        agent_id: uuid.UUID,
        action_name: str,
        payload: dict[str, Any],
        idempotency_key: str,
    ) -> Action:
        """Process a check request and return the action.

        Handles idempotency: if the same idempotency_key is used for the same
        agent, returns the existing action instead of creating a new one.

        For now, always returns "allowed" with reason "no policies configured".
        Policy evaluation will be added in a future prompt.
        """
        # Check for existing action with same idempotency key
        result = await self.session.execute(
            select(Action).where(
                Action.agent_id == agent_id,
                Action.idempotency_key == idempotency_key,
            )
        )
        existing_action = result.scalar_one_or_none()

        if existing_action:
            logger.info(
                "idempotent_request",
                action_id=str(existing_action.id),
                agent_id=str(agent_id),
            )
            return existing_action

        # Create new action with allowed decision (no policies configured yet)
        now = datetime.now(UTC)
        action = Action(
            agent_id=agent_id,
            action_name=action_name,
            payload=payload,
            decision=Decision.ALLOWED,
            decision_reason="no policies configured",
            idempotency_key=idempotency_key,
            decided_at=now,
        )
        self.session.add(action)
        await self.session.flush()

        logger.info(
            "action_checked",
            action_id=str(action.id),
            agent_id=str(agent_id),
            action_name=action_name,
            decision="allowed",
        )

        return action
