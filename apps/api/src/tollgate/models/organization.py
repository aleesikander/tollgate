"""Organization model."""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tollgate.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tollgate.models.agent import Agent
    from tollgate.models.user import User


class Organization(Base, UUIDMixin, TimestampMixin):
    """Organization that owns agents and users."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    agents: Mapped[list["Agent"]] = relationship(
        "Agent",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
