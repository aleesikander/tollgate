"""Action model."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from tollgate.models.approval_request import ApprovalRequest

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tollgate.models.agent import Agent
from tollgate.models.base import Base, TimestampMixin, UUIDMixin


class Decision(str, enum.Enum):
    """Action decision status."""

    ALLOWED = "allowed"
    DENIED = "denied"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Action(Base, UUIDMixin, TimestampMixin):
    """Action request from an agent."""

    __tablename__ = "actions"
    __table_args__ = (
        Index("ix_actions_agent_created", "agent_id", "created_at"),
        Index("ix_actions_decision", "decision"),
        Index(
            "ix_actions_agent_idempotency",
            "agent_id",
            "idempotency_key",
            unique=True,
        ),
    )

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    action_name: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    decision: Mapped[Decision] = mapped_column(
        Enum(Decision, name="decision", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="actions")
    approval_request: Mapped["ApprovalRequest | None"] = relationship(
        "ApprovalRequest",
        back_populates="action",
        uselist=False,
        cascade="all, delete-orphan",
    )
