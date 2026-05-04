"""Tests for the context manager API."""

import httpx
import pytest
import respx

from tollgate import ActionDenied, Tollgate

BASE_URL = "http://test.tollgate.local"
API_KEY = "tg_live_testkey"
ACTION_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"


def _tg() -> Tollgate:
    return Tollgate(api_key=API_KEY, base_url=BASE_URL)


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_context_manager_allow(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(
        return_value=httpx.Response(200, json={"decision": "allowed", "action_id": ACTION_ID, "reason": "ok"})
    )
    tg = _tg()
    executed = []
    with tg.check("refund", {"amount": 30}):
        executed.append(True)
    assert executed, "block should have executed"


@respx.mock(base_url=BASE_URL, assert_all_called=False)
def test_context_manager_deny_raises(respx_mock: respx.MockRouter) -> None:
    respx_mock.post("/v1/check").mock(
        return_value=httpx.Response(200, json={"decision": "denied", "action_id": ACTION_ID, "reason": "denied"})
    )
    tg = _tg()
    executed = []
    with pytest.raises(ActionDenied):
        with tg.check("refund", {"amount": 9999}):
            executed.append(True)
    assert not executed, "block should not have executed"
