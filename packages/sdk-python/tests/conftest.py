"""Shared test fixtures."""

import pytest
import respx

BASE_URL = "http://test.tollgate.local"
API_KEY = "tg_live_testkey123"
ACTION_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def base_url() -> str:
    return BASE_URL


@pytest.fixture
def api_key() -> str:
    return API_KEY


@pytest.fixture
def action_id() -> str:
    return ACTION_ID


@pytest.fixture
def mock_router():
    """Active respx router for HTTP mocking."""
    with respx.mock(base_url=BASE_URL, assert_all_called=False) as router:
        yield router
