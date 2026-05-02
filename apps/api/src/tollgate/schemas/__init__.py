"""Pydantic schemas for request/response validation."""

from tollgate.schemas.action import CheckRequest, CheckResponse
from tollgate.schemas.agent import AgentResponse, AgentWithKeyResponse, CreateAgentRequest
from tollgate.schemas.auth import AuthResponse, LoginRequest, SignupRequest
from tollgate.schemas.common import ErrorDetail, ErrorResponse

__all__ = [
    "AgentResponse",
    "AgentWithKeyResponse",
    "AuthResponse",
    "CheckRequest",
    "CheckResponse",
    "CreateAgentRequest",
    "ErrorDetail",
    "ErrorResponse",
    "LoginRequest",
    "SignupRequest",
]
