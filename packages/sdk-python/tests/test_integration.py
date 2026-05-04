"""Integration tests — hit a real running Tollgate API.

Run with:
    TOLLGATE_API_URL=http://localhost:8000 \\
    TOLLGATE_API_KEY=tg_live_... \\
    RUN_INTEGRATION_TESTS=1 \\
    pytest tests/test_integration.py -v

Prerequisites:
    - API server running at TOLLGATE_API_URL
    - Agent with API key TOLLGATE_API_KEY registered
    - Active policy that allows "integration_allow_test" and denies "integration_deny_test"
      Example policy:
        version: 1
        rules:
          - action: integration_deny_test
            decide: deny
            reason: "Integration test deny"
        default: allow
"""

import os
import time

import pytest

RUN = os.getenv("RUN_INTEGRATION_TESTS") == "1"
pytestmark = pytest.mark.skipif(not RUN, reason="RUN_INTEGRATION_TESTS not set")


@pytest.fixture(scope="module")
def tg():
    from tollgate import Tollgate

    api_url = os.environ.get("TOLLGATE_API_URL", "http://localhost:8000")
    api_key = os.environ["TOLLGATE_API_KEY"]
    return Tollgate(api_key=api_key, base_url=api_url)


def test_allows_permitted_action(tg):
    result = tg.check_action("integration_allow_test", {"source": "sdk-py-integration"})
    assert result.decision == "allowed"
    assert result.action_id


def test_denies_blocked_action(tg):
    from tollgate import ActionDenied

    with pytest.raises(ActionDenied):
        tg.check_action("integration_deny_test", {"source": "sdk-py-integration"})


def test_idempotency_key_reuses_decision(tg):
    key = f"py-idem-{int(time.time() * 1000)}"
    r1 = tg.check_action("integration_allow_test", {}, idempotency_key=key)
    r2 = tg.check_action("integration_allow_test", {}, idempotency_key=key)
    assert r1.action_id == r2.action_id
    assert r1.decision == "allowed"


def test_invalid_api_key_raises_auth_error():
    from tollgate import Tollgate, TollgateAuthError

    api_url = os.environ.get("TOLLGATE_API_URL", "http://localhost:8000")
    bad_tg = Tollgate(api_key="tg_live_invalid_key_000", base_url=api_url)
    with pytest.raises(TollgateAuthError):
        bad_tg.check_action("integration_allow_test", {})


def test_guard_wraps_function(tg):
    calls = []

    @tg.guard("integration_allow_test")
    def do_something(x: int) -> int:
        calls.append(x)
        return x * 3

    result = do_something(7)
    assert result == 21
    assert calls == [7]


@pytest.mark.asyncio
async def test_async_allows_permitted_action():
    from tollgate import AsyncTollgate

    api_url = os.environ.get("TOLLGATE_API_URL", "http://localhost:8000")
    api_key = os.environ["TOLLGATE_API_KEY"]
    async_tg = AsyncTollgate(api_key=api_key, base_url=api_url)
    result = await async_tg.check_action(
        "integration_allow_test", {"source": "sdk-py-async-integration"}
    )
    assert result.decision == "allowed"
