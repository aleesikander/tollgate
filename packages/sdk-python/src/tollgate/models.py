"""Tollgate SDK data models."""

from typing import Literal

from pydantic import BaseModel, computed_field


class Decision(BaseModel):
    """Result of a policy check."""

    decision: Literal["allowed", "denied", "pending"]
    action_id: str
    reason: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed(self) -> bool:
        """True when the action was allowed."""
        return self.decision == "allowed"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def denied(self) -> bool:
        """True when the action was denied."""
        return self.decision == "denied"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def pending(self) -> bool:
        """True when the action is awaiting human approval."""
        return self.decision == "pending"
