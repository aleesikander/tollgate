"""Policy schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CreatePolicyRequest(BaseModel):
    """Request schema for creating a policy."""

    source_yaml: str = Field(min_length=1)


class PolicyResponse(BaseModel):
    """Response schema for a policy."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    version: int
    source_yaml: str
    parsed_json: dict[str, Any]
    is_active: bool
    created_at: datetime
    created_by_user_id: uuid.UUID | None


class PolicySummaryResponse(BaseModel):
    """Summary response for policy listing."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    is_active: bool
    created_at: datetime
