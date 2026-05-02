"""Agent schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from tollgate.models.agent import AgentStatus


class CreateAgentRequest(BaseModel):
    """Request schema for creating an agent."""

    name: str = Field(min_length=1, max_length=255)


class AgentResponse(BaseModel):
    """Response schema for agent (without API key)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    api_key_prefix: str
    status: AgentStatus
    created_at: datetime


class AgentWithKeyResponse(BaseModel):
    """Response schema for agent with API key (only on creation)."""

    id: uuid.UUID
    name: str
    api_key: str
    api_key_prefix: str
    status: AgentStatus
    created_at: datetime
