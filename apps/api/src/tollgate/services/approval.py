"""Approval service for managing approval requests."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from tollgate.logging import get_logger
from tollgate.models import Action, ApprovalRequest, ApprovalStatus, Decision

logger = get_logger(__name__)

# Default approval expiry time
APPROVAL_EXPIRY_MINUTES = 5


class ApprovalError(Exception):
    """Base approval error."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class ApprovalService:
    """Service for approval request operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_approval_request(
        self,
        action_id: uuid.UUID,
        approvers: list[str],
        expiry_minutes: int = APPROVAL_EXPIRY_MINUTES,
    ) -> ApprovalRequest:
        """Create an approval request for an action.

        Args:
            action_id: Action ID
            approvers: List of approver identifiers (e.g., Slack channels)
            expiry_minutes: Minutes until request expires

        Returns:
            The created ApprovalRequest
        """
        expires_at = datetime.now(UTC) + timedelta(minutes=expiry_minutes)

        approval = ApprovalRequest(
            action_id=action_id,
            approvers_config={"approvers": approvers},
            status=ApprovalStatus.PENDING,
            expires_at=expires_at,
        )
        self.session.add(approval)
        await self.session.flush()

        # Log stub for Slack notification
        logger.info(
            "would_notify_approvers",
            action_id=str(action_id),
            approvers=approvers,
            expires_at=expires_at.isoformat(),
        )

        return approval

    async def get_approval_request(self, action_id: uuid.UUID) -> ApprovalRequest | None:
        """Get approval request by action ID."""
        result = await self.session.execute(
            select(ApprovalRequest).where(ApprovalRequest.action_id == action_id)
        )
        return result.scalar_one_or_none()

    async def decide_approval(
        self,
        action_id: uuid.UUID,
        decision: str,
        decided_by_user_id: uuid.UUID,
    ) -> tuple[ApprovalRequest, Action] | None:
        """Decide on an approval request.

        Args:
            action_id: Action ID
            decision: "approved" or "rejected"
            decided_by_user_id: User making the decision

        Returns:
            Tuple of (ApprovalRequest, Action) if successful, None if not found

        Raises:
            ApprovalError: If approval is not pending or already decided
        """
        # Get approval request
        approval = await self.get_approval_request(action_id)
        if not approval:
            return None

        # Check status
        if approval.status != ApprovalStatus.PENDING:
            raise ApprovalError(
                "NOT_PENDING",
                f"Approval request is not pending (status: {approval.status.value})",
            )

        # Check expiry
        if datetime.now(UTC) > approval.expires_at:
            raise ApprovalError("EXPIRED", "Approval request has expired")

        # Update approval request
        now = datetime.now(UTC)
        new_status = ApprovalStatus.APPROVED if decision == "approved" else ApprovalStatus.REJECTED
        approval.status = new_status
        approval.decided_by_user_id = decided_by_user_id
        approval.decided_at = now

        # Update action
        result = await self.session.execute(
            select(Action).where(Action.id == action_id)
        )
        action = result.scalar_one()

        if decision == "approved":
            action.decision = Decision.APPROVED
            action.decision_reason = "approved by user"
        else:
            action.decision = Decision.REJECTED
            action.decision_reason = "rejected by user"
        action.decided_at = now

        await self.session.flush()

        logger.info(
            "approval_decided",
            action_id=str(action_id),
            decision=decision,
            decided_by=str(decided_by_user_id),
        )

        return approval, action

    async def expire_pending_approvals(self) -> int:
        """Expire all pending approval requests that have passed their expiry time.

        Returns:
            Number of expired requests
        """
        now = datetime.now(UTC)

        # Find pending approvals that have expired
        result = await self.session.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.status == ApprovalStatus.PENDING,
                ApprovalRequest.expires_at < now,
            )
        )
        expired_approvals = list(result.scalars().all())

        if not expired_approvals:
            return 0

        # Update approval requests
        action_ids = [a.action_id for a in expired_approvals]

        await self.session.execute(
            update(ApprovalRequest)
            .where(ApprovalRequest.action_id.in_(action_ids))
            .values(
                status=ApprovalStatus.EXPIRED,
                decided_at=now,
            )
        )

        # Update actions
        await self.session.execute(
            update(Action)
            .where(Action.id.in_(action_ids))
            .values(
                decision=Decision.REJECTED,
                decision_reason="approval timed out",
                decided_at=now,
            )
        )

        await self.session.flush()

        logger.info("approvals_expired", count=len(expired_approvals))

        return len(expired_approvals)
