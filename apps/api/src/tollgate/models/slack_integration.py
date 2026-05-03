"""Slack integration model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tollgate.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from tollgate.models.organization import Organization
    from tollgate.models.user import User


class SlackIntegration(Base, UUIDMixin):
    """Slack workspace integration for an organization."""

    __tablename__ = "slack_integrations"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One Slack workspace per org
        index=True,
    )
    team_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    team_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bot_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    bot_user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    installed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    installed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="slack_integration",
    )
    installed_by: Mapped["User | None"] = relationship("User")
