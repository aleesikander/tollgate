"""Tests for Tollgate.check_action — the core decision flow."""

import logging

import httpx
import pytest
import respx

from tollgate import ActionDenied, ActionPending, Decision, Tollgate
from tollgate.exceptions import TollgateAuthError, TollgateConnectionError

BASE_URL = "http://test.tollgate.local"
API_KEY = "tg_live_testkey"
ACTION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def _tg(**kw):  # type: ignore[no-untyped-def]
    return Tollgate(api_key=API_KEY, base_url=BASE_URL, **kw)


def _allowed_resp(action_id: str = ACTION_ID) -> dict:  # type: ignore[type-arg]
    return {"decision": "allowed", "action_id": action_id, "reason": "matched rule"}


def _denied_resp(reason: str = "policy denied") -> dict:  # type: ignore[type-arg]
    return {"decision": "denied", "action_id": ACTION_ID, "reason": reason}


def _pending_resp(action_id: str = ACTION_ID) -> dict:  # type: ignore[type-arg]
    return {"decision": "pending", "action_id": action_id, "reason": "requires approval"}


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_allow_returns_decision(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_allowed_resp()))
    tg = _tg()
    d = tg.check_action("refund", {"amount": 30})
    assert isinstance(d, Decision)
    assert d.allowed
    assert d.action_id == ACTION_ID


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_deny_raises_action_denied(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_denied_resp("too large")))
    tg = _tg()
    with pytest.raises(ActionDenied) as exc_info:
        tg.check_action("refund", {"amount": 9999})
    assert "too large" in str(exc_info.value)
    assert exc_info.value.reason == "too large"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_pending_then_approved(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_pending_resp()))
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(
        return_value=httpx.Response(200, json={"decision": "approved", "action_id": ACTION_ID, "reason": "approved by user"})
    )
    tg = _tg(poll_interval=0.01)
    d = tg.check_action("refund", {"amount": 200})
    assert d.allowed


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_pending_then_rejected(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_pending_resp()))
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(
        return_value=httpx.Response(200, json={"decision": "rejected", "action_id": ACTION_ID, "reason": "rejected by user"})
    )
    tg = _tg(poll_interval=0.01)
    with pytest.raises(ActionDenied):
        tg.check_action("refund", {"amount": 200})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_pending_timeout(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_pending_resp()))
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(
        return_value=httpx.Response(200, json=_pending_resp())
    )
    tg = _tg(poll_interval=0.01, max_wait=0.05)
    with pytest.raises(ActionPending) as exc_info:
        tg.check_action("refund", {"amount": 200})
    assert exc_info.value.action_id == ACTION_ID


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_idempotency_key_auto_generated(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_allowed_resp()))
    tg = _tg()
    tg.check_action("refund", {})
    body = route.calls[0].request.content
    import json
    parsed = json.loads(body)
    assert "idempotency_key" in parsed
    assert len(parsed["idempotency_key"]) == 36  # UUID format


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_idempotency_key_override(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=httpx.Response(200, json=_allowed_resp()))
    tg = _tg()
    tg.check_action("refund", {}, idempotency_key="my-custom-key")
    import json
    parsed = json.loads(route.calls[0].request.content)
    assert parsed["idempotency_key"] == "my-custom-key"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_5xx_retries_then_raises(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(500, text="server error"))
    tg = _tg()
    with pytest.raises(TollgateConnectionError):
        tg.check_action("refund", {})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_401_raises_auth_error(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(401, text="unauthorized"))
    tg = _tg()
    with pytest.raises(TollgateAuthError):
        tg.check_action("refund", {})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_fail_open_false_raises_on_network_error(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(side_effect=httpx.ConnectError("connection refused"))
    tg = _tg(fail_open=False)
    with pytest.raises(TollgateConnectionError):
        tg.check_action("refund", {})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_fail_open_true_allows_on_network_error(respx_mock: respx.MockRouter, caplog: pytest.LogCaptureFixture) -> None:
    respx_mock.post("/v1/check").mock(side_effect=httpx.ConnectError("connection refused"))
    tg = _tg(fail_open=True)
    with caplog.at_level(logging.WARNING, logger="tollgate"):
        d = tg.check_action("refund", {})
    assert d.allowed
    assert any("fail_open" in r.message for r in caplog.records)
