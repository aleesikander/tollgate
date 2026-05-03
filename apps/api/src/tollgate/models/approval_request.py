"""Approval request model."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tollgate.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tollgate.models.action import Action
    from tollgate.models.user import User


class ApprovalStatus(str, enum.Enum):
    """Approval request status."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ApprovalRequest(Base, UUIDMixin, TimestampMixin):
    """Approval request for a pending action."""

    __tablename__ = "approval_requests"
    __table_args__ = (
        Index("ix_approval_requests_status_expires", "status", "expires_at"),
    )

    action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("actions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    approvers_config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(
            ApprovalStatus,
            name="approval_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ApprovalStatus.PENDING,
    )
    decided_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    action: Mapped["Action"] = relationship("Action", back_populates="approval_request")
    decided_by: Mapped["User | None"] = relationship("User")
