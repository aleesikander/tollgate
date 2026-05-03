"""Action schemas."""

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class CheckRequest(BaseModel):
    """Request schema for the /v1/check endpoint."""

    action_name: str = Field(min_length=1, max_length=255)
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=1, max_length=255)


class CheckResponse(BaseModel):
    """Response schema for the /v1/check endpoint."""

    decision: Literal["allowed", "denied", "pending"]
    action_id: uuid.UUID
    reason: str


class ActionStatusResponse(BaseModel):
    """Response schema for action status check."""

    action_id: uuid.UUID
    decision: Literal["allowed", "denied", "pending", "approved", "rejected"]
    reason: str
