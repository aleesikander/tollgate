"""Tests for AsyncTollgate."""

import logging

import httpx
import pytest
import respx

from tollgate import ActionDenied, ActionPending, AsyncTollgate
from tollgate.exceptions import TollgateAuthError, TollgateConnectionError

BASE_URL = "http://test.tollgate.local"
API_KEY = "tg_live_testkey"
ACTION_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"


def _tg(**kw):  # type: ignore[no-untyped-def]
    return AsyncTollgate(api_key=API_KEY, base_url=BASE_URL, **kw)


def _allowed() -> httpx.Response:
    return httpx.Response(200, json={"decision": "allowed", "action_id": ACTION_ID, "reason": "ok"})


def _denied() -> httpx.Response:
    return httpx.Response(200, json={"decision": "denied", "action_id": ACTION_ID, "reason": "denied"})


def _pending() -> httpx.Response:
    return httpx.Response(200, json={"decision": "pending", "action_id": ACTION_ID, "reason": "pending"})


def _approved() -> httpx.Response:
    return httpx.Response(200, json={"decision": "approved", "action_id": ACTION_ID, "reason": "approved"})


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_allow(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_allowed())
    tg = _tg()
    d = await tg.check_action("refund", {"amount": 30})
    assert d.allowed
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_deny(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_denied())
    tg = _tg()
    with pytest.raises(ActionDenied):
        await tg.check_action("refund", {"amount": 9999})
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_pending_then_approved(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_pending())
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(return_value=_approved())
    tg = _tg(poll_interval=0.01)
    d = await tg.check_action("refund", {"amount": 200})
    assert d.allowed
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_pending_timeout(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=_pending())
    respx_mock.get(f"/v1/check/{ACTION_ID}").mock(return_value=_pending())
    tg = _tg(poll_interval=0.01, max_wait=0.05)
    with pytest.raises(ActionPending):
        await tg.check_action("refund", {"amount": 200})
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_fail_open_false(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(side_effect=httpx.ConnectError("refused"))
    tg = _tg(fail_open=False)
    with pytest.raises(TollgateConnectionError):
        await tg.check_action("refund", {})
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_fail_open_true(respx_mock: respx.MockRouter, caplog: pytest.LogCaptureFixture) -> None:
    respx_mock.post("/v1/check").mock(side_effect=httpx.ConnectError("refused"))
    tg = _tg(fail_open=True)
    with caplog.at_level(logging.WARNING, logger="tollgate"):
        d = await tg.check_action("refund", {})
    assert d.allowed
    assert any("fail_open" in r.message for r in caplog.records)
    await tg.aclose()


@respx.mock(base_url=BASE_URL, assert_all_called=False)
async def test_async_401_raises_auth_error(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(return_value=httpx.Response(401, text="unauthorized"))
    tg = _tg()
    with pytest.raises(TollgateAuthError):
        await tg.check_action("refund", {})
    await tg.aclose()
