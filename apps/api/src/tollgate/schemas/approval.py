"""Approval schemas."""

import uuid
from typing import Literal

from pydantic import BaseModel


class DecideRequest(BaseModel):
    """Request schema for deciding on an approval."""

    decision: Literal["approved", "rejected"]
    user_id: uuid.UUID


class DecideResponse(BaseModel):
    """Response schema for decide endpoint."""

    action_id: uuid.UUID
    decision: str
    decided_at: str
