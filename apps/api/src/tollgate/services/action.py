"""Action service."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from tollgate.logging import get_logger
from tollgate.models import Action, ApprovalRequest, Decision, Policy
from tollgate.services.approval import ApprovalService
from tollgate.services.policy_cache import get_policy_cache
from tollgate.services.policy_evaluator import evaluate

logger = get_logger(__name__)


class ActionService:
    """Service for action/check operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._cache = get_policy_cache()

    async def _get_active_policy(self, agent_id: uuid.UUID) -> Policy | None:
        """Get active policy, using cache when available."""
        # Check cache first
        cached = self._cache.get(agent_id)
        if cached:
            logger.debug("policy_cache_hit", agent_id=str(agent_id), version=cached.version)
            # Return a minimal Policy-like object for the evaluator
            # We just need parsed_json for evaluation
            return type(  # type: ignore[no-any-return]
                "CachedPolicy",
                (),
                {"id": cached.policy_id, "version": cached.version, "parsed_json": cached.parsed_json},
            )()

        # Cache miss - fetch from DB
        result = await self.session.execute(
            select(Policy).where(
                Policy.agent_id == agent_id,
                Policy.is_active == True,  # noqa: E712
            )
        )
        policy = result.scalar_one_or_none()

        if policy:
            # Cache the policy
            self._cache.set(
                agent_id=agent_id,
                policy_id=policy.id,
                version=policy.version,
                parsed_json=policy.parsed_json,
            )
            logger.debug("policy_cache_miss", agent_id=str(agent_id), version=policy.version)

        return policy

    async def check_action(
        self,
        agent_id: uuid.UUID,
        action_name: str,
        payload: dict[str, Any],
        idempotency_key: str,
    ) -> tuple[Action, dict[str, Any] | None]:
        """Process a check request and return the action.

        Handles idempotency: if the same idempotency_key is used for the same
        agent, returns the existing action instead of creating a new one.

        Evaluates the active policy for the agent and returns the decision.

        Returns:
            Tuple of (Action, pending_info) where pending_info is None unless
            the decision is pending, in which case it contains info for Slack
            notification: {"approvers": [...], "reason": "...", "expires_at": datetime}
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
            return existing_action, None

        # Get active policy
        policy = await self._get_active_policy(agent_id)

        if not policy:
            # No policy configured - allow by default (backwards compatible)
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
                reason="no policies configured",
            )
            return action, None

        # Evaluate policy
        eval_result = evaluate(policy.parsed_json, action_name, payload)
        now = datetime.now(UTC)

        # Map evaluation result to decision
        if eval_result.decision == "allow":
            decision = Decision.ALLOWED
            decided_at = now
        elif eval_result.decision == "deny":
            decision = Decision.DENIED
            decided_at = now
        else:  # require_approval
            decision = Decision.PENDING
            decided_at = None

        # Create action
        action = Action(
            agent_id=agent_id,
            action_name=action_name,
            payload=payload,
            decision=decision,
            decision_reason=eval_result.reason,
            idempotency_key=idempotency_key,
            decided_at=decided_at,
        )
        self.session.add(action)
        await self.session.flush()

        # Create approval request if pending
        pending_info: dict[str, Any] | None = None
        if decision == Decision.PENDING:
            approval_service = ApprovalService(self.session)
            approval_request = await approval_service.create_approval_request(
                action_id=action.id,
                approvers=eval_result.approvers,
            )
            pending_info = {
                "approvers": eval_result.approvers,
                "reason": eval_result.reason,
                "expires_at": approval_request.expires_at,
            }

        logger.info(
            "action_checked",
            action_id=str(action.id),
            agent_id=str(agent_id),
            action_name=action_name,
            decision=decision.value,
            reason=eval_result.reason,
        )

        return action, pending_info

    async def get_action(self, action_id: uuid.UUID) -> Action | None:
        """Get an action by ID with its approval request if any."""
        result = await self.session.execute(
            select(Action)
            .options(joinedload(Action.approval_request))
            .where(Action.id == action_id)
        )
        return result.scalar_one_or_none()

    async def get_action_for_agent(self, action_id: uuid.UUID, agent_id: uuid.UUID) -> Action | None:
        """Get an action by ID, ensuring it belongs to the agent."""
        result = await self.session.execute(
            select(Action)
            .options(joinedload(Action.approval_request))
            .where(Action.id == action_id, Action.agent_id == agent_id)
        )
        return result.scalar_one_or_none()
