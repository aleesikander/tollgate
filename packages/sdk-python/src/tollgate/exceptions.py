"""Tollgate SDK exception hierarchy."""


class TollgateError(Exception):
    """Base exception for all Tollgate SDK errors."""


class TollgateConnectionError(TollgateError):
    """Raised when the SDK cannot reach the Tollgate API."""

    def __str__(self) -> str:
        msg = self.args[0] if self.args else "Could not connect to Tollgate API"
        return f"TollgateConnectionError: {msg}"


class TollgateAuthError(TollgateError):
    """Raised when the API key is invalid or unauthorized."""

    def __str__(self) -> str:
        msg = self.args[0] if self.args else "Authentication failed"
        return f"TollgateAuthError: {msg}"


class ActionDenied(TollgateError):
    """Raised when a policy denies or a human rejects the action."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason

    def __str__(self) -> str:
        return f"ActionDenied: {self.reason}"


class ActionPending(TollgateError):
    """Raised when the approval wait timed out with no decision."""

    def __init__(self, action_id: str, timeout_seconds: int) -> None:
        super().__init__(action_id, timeout_seconds)
        self.action_id = action_id
        self.timeout_seconds = timeout_seconds

    def __str__(self) -> str:
        return (
            f"ActionPending: no decision received for action {self.action_id} "
            f"after {self.timeout_seconds}s"
        )
