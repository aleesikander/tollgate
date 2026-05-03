"""Policy model."""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tollgate.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tollgate.models.agent import Agent
    from tollgate.models.user import User


class Policy(Base, UUIDMixin, TimestampMixin):
    """Policy for an agent defining action rules."""

    __tablename__ = "policies"
    __table_args__ = (
        Index("ix_policies_agent_active", "agent_id", "is_active"),
    )

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_yaml: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="policies")
    created_by: Mapped["User"] = relationship("User")
