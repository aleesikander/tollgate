"""Authentication middleware."""

import uuid
from dataclasses import dataclass

from tollgate.models import UserRole


@dataclass
class CurrentUser:
    """Represents the currently authenticated user."""

    id: uuid.UUID
    org_id: uuid.UUID
    role: UserRole


@dataclass
class CurrentAgent:
    """Represents the currently authenticated agent."""

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
