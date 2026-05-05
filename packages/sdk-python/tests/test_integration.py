"""Integration tests — hit the real Tollgate API.

Run with: RUN_INTEGRATION_TESTS=1 pytest tests/test_integration.py -v
"""

import os
import uuid

import pytest

from tollgate import (
    ActionDenied,
    ActionPending,
    AsyncTollgate,
    TollgateAuthError,
    TollgateConnectionError,
    Tollgate,
)

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1",
    reason="Set RUN_INTEGRATION_TESTS=1 to run integration tests",
)

BASE_URL = "http://localhost:8000"
API_KEY = "tg_live_3bdccda9390439d587e7a198dbcb4de1"


def _tg(**kw: object) -> Tollgate:
    return Tollgate(api_key=API_KEY, base_url=BASE_URL, poll_interval=0.5, **kw)  # type: ignore[arg-type]


def _async_tg(**kw: object) -> AsyncTollgate:
    return AsyncTollgate(api_key=API_KEY, base_url=BASE_URL, poll_interval=0.5, **kw)  # type: ignore[arg-type]


# --- check_action ---


def test_check_allow() -> None:
    result = _tg().check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})
    assert result.allowed
    assert result.action_id != ""


def test_check_deny() -> None:
    with pytest.raises(ActionDenied) as exc_info:
        _tg().check_action("issue_refund", {"amount": 1000, "customer_id": "c_int"})
    assert exc_info.value.reason


def test_check_default_deny() -> None:
    with pytest.raises(ActionDenied):
        _tg().check_action("unknown_action", {})


def test_idempotency_auto_generated() -> None:
    tg = _tg()
    r1 = tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})
    r2 = tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})
    assert r1.action_id != r2.action_id


def test_idempotency_override() -> None:
    key = f"int-idem-{uuid.uuid4()}"
    tg = _tg()
    r1 = tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"}, idempotency_key=key)
    r2 = tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"}, idempotency_key=key)
    assert r1.action_id == r2.action_id


# --- guard ---


def test_guard_allow() -> None:
    tg = _tg()
    called = []

    @tg.guard("issue_refund")
    def do_refund(amount: float, customer_id: str) -> str:
        called.append(True)
        return "refunded"

    result = do_refund(amount=30, customer_id="c_int")
    assert result == "refunded"
    assert called


def test_guard_deny() -> None:
    tg = _tg()
    called = []

    @tg.guard("issue_refund")
    def do_refund(amount: float, customer_id: str) -> str:
        called.append(True)
        return "refunded"

    with pytest.raises(ActionDenied):
        do_refund(amount=1000, customer_id="c_int")
    assert not called


def test_guard_with_payload_mapper() -> None:
    tg = _tg()

    @tg.guard("issue_refund", payload=lambda args: {"amount": args["amount"], "customer_id": "c_mapper"})
    def do_refund(amount: float, internal_ref: str) -> str:
        return "ok"

    result = do_refund(30, "internal-only")
    assert result == "ok"


# --- context manager (check) ---


def test_with_check_allow() -> None:
    executed = []
    with _tg().check("issue_refund", {"amount": 30, "customer_id": "c_int"}):
        executed.append(True)
    assert executed


def test_with_check_deny() -> None:
    executed = []
    with pytest.raises(ActionDenied):
        with _tg().check("issue_refund", {"amount": 1000, "customer_id": "c_int"}):
            executed.append(True)
    assert not executed


# --- error handling ---


def test_auth_error() -> None:
    tg = Tollgate(api_key="tg_live_invalid_key", base_url=BASE_URL)
    with pytest.raises(TollgateAuthError):
        tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})


def test_connection_error_fail_closed() -> None:
    tg = Tollgate(api_key=API_KEY, base_url="http://localhost:19999")
    with pytest.raises(TollgateConnectionError):
        tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})


def test_connection_error_fail_open() -> None:
    tg = Tollgate(api_key=API_KEY, base_url="http://localhost:19999", fail_open=True)
    result = tg.check_action("issue_refund", {"amount": 30, "customer_id": "c_int"})
    assert result.allowed


# --- pending (poll timeout) ---


def test_pending_returns_action_id() -> None:
    tg = _tg(max_wait=1.0)
    with pytest.raises(ActionPending) as exc_info:
        tg.check_action("issue_refund", {"amount": 200, "customer_id": "c_int"})
    exc = exc_info.value
    assert exc.action_id != ""
    assert exc.timeout_seconds == 1
