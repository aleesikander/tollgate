"""Tests for the @tg.guard decorator."""

import json

import httpx
import pytest
import respx

from tollgate import ActionDenied, AsyncTollgate, Tollgate

BASE_URL = "http://test.tollgate.local"
API_KEY = "tg_live_testkey"
ACTION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _tg(**kw):  # type: ignore[no-untyped-def]
    return Tollgate(api_key=API_KEY, base_url=BASE_URL, **kw)


def _async_tg(**kw):  # type: ignore[no-untyped-def]
    return AsyncTollgate(api_key=API_KEY, base_url=BASE_URL, **kw)


def _allowed() -> httpx.Response:
    return httpx.Response(200, json={"decision": "allowed", "action_id": ACTION_ID, "reason": "ok"})


def _denied() -> httpx.Response:
    return httpx.Response(200, json={"decision": "denied", "action_id": ACTION_ID, "reason": "policy denied"})


def _pending() -> httpx.Response:
    return httpx.Response(200, json={"decision": "pending", "action_id": ACTION_ID, "reason": "needs approval"})


def _approved() -> httpx.Response:
    return httpx.Response(200, json={"decision": "approved", "action_id": ACTION_ID, "reason": "approved"})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_guard_allow_executes_function(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()

    @tg.guard("refund")
    def do_refund(amount: float) -> str:
        return f"refunded {amount}"

    result = do_refund(50.0)
    assert result == "refunded 50.0"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_guard_deny_raises_before_function(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_denied())
    called = []
    tg = _tg()

    @tg.guard("refund")
    def do_refund(amount: float) -> str:
        called.append(True)
        return "refunded"

    with pytest.raises(ActionDenied):
        do_refund(9999.0)
    assert not called, "function should not have been called"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_guard_pending_approved_executes(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_pending())
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(return_value=_approved())
    tg = _tg(poll_interval=0.01)

    @tg.guard("refund")
    def do_refund(amount: float) -> str:
        return "done"

    assert do_refund(200.0) == "done"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_auto_payload_extraction_kwargs(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()

    @tg.guard("refund")
    def do_refund(amount: float, customer_id: str) -> str:
        return "done"

    do_refund(amount=99.0, customer_id="c_123")
    payload = json.loads(route.calls[0].request.content)["payload"]
    assert payload == {"amount": 99.0, "customer_id": "c_123"}


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_auto_payload_extraction_positional(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()

    @tg.guard("refund")
    def do_refund(amount: float, customer_id: str) -> str:
        return "done"

    do_refund(42.0, "c_456")
    payload = json.loads(route.calls[0].request.content)["payload"]
    assert payload == {"amount": 42.0, "customer_id": "c_456"}


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_custom_payload_extractor(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()

    @tg.guard("refund", payload=lambda args: {"amount": args["amount"]})
    def do_refund(amount: float, internal_ref: str) -> str:
        return "done"

    do_refund(75.0, internal_ref="internal-only")
    payload = json.loads(route.calls[0].request.content)["payload"]
    assert payload == {"amount": 75.0}
    assert "internal_ref" not in payload


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_guard_on_method(respx_mock: respx.MockRouter) -> None:
    route = respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()

    class RefundService:
        @tg.guard("refund")
        def issue_refund(self, amount: float) -> str:
            return "done"

    svc = RefundService()
    svc.issue_refund(50.0)
    payload = json.loads(route.calls[0].request.content)["payload"]
    assert "self" not in payload
    assert payload == {"amount": 50.0}


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_guard_on_async_function(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _async_tg()

    @tg.aguard("refund")
    async def do_refund(amount: float) -> str:
        return "async done"

    result = await do_refund(50.0)
    assert result == "async done"
    await tg.aclose()
