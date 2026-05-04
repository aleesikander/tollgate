# Tollgate Build Log

## 2026-05-04: Python SDK (Prompt 4)

- **Package**: `packages/sdk-python/` — `tollgate-sdk`, Python 3.10+
- **Core patterns**: `@tg.guard()` decorator, `with tg.check()` context manager, explicit `tg.check_action()`
- **Pending polling**: polls `GET /v1/check/{action_id}` every 2s; handles `approved`/`rejected`/`expired` responses
- **`fail_open`**: network errors either raise `TollgateConnectionError` (default) or allow through with warning log
- **Async**: `AsyncTollgate` mirrors sync client with `httpx.AsyncClient` and `asyncio.sleep`
- **Tests**: 28 tests, all passing, respx HTTP mocking, mypy strict clean
- **Example**: `packages/sdk-python/examples/support_agent.py` — Claude-backed support agent with 3 guarded tools

## 2026-05-05: Reverted AI Policy Generator

Reverted AI policy generator feature (was scope creep, not in any prompt spec). Code preserved on `feature/ai-policy-generator` branch for potential future use.

Audit revealed the following other unscoped changes made during Prompts 5-6 (all intentional, listed for transparency):
- `apps/api/src/tollgate/main.py` — added `CORSMiddleware` for `localhost:3000` to allow the dashboard dev server to reach the API. Needed for Prompt 5 to function.
- `apps/api/src/tollgate/routes/v1/dashboard.py` — new file adding `/v1/audit`, `/v1/audit/hourly`, `/v1/stats`, and `POST /v1/check/{id}/decide` endpoints. Built for Prompt 5 dashboard; not separately spec'd in any API prompt.
- `packages/sdk-python/tests/test_integration.py` — integration test stub gated on `RUN_INTEGRATION_TESTS=1`. Not in Prompt 4 spec; added proactively alongside Prompt 6 SDK work.
- `packages/sdk-typescript/tests/integration.test.ts` — same, TypeScript SDK integration test stub.
- Pre-existing mypy errors in `apps/api/src/tollgate/routes/slack.py` (4 errors) — in the committed Prompt 3 code before this session began, not introduced here.

Notable technical decisions and changes during development.

## 2025-05-04: Removed Hardcoded ngrok URLs

- **Change**: Replaced hardcoded ngrok URLs with configurable `PUBLIC_BASE_URL` env var
- **Impact**: Slack OAuth callbacks now use `settings.public_base_url` instead of hardcoded URLs

## 2025-05-03: Slack Integration (Prompt 3)

- **Feature**: Full Slack integration for human-in-the-loop approval workflows
- **Components Added**:
  - `slack_integrations` table with encrypted bot tokens (Fernet)
  - OAuth flow for Slack workspace installation
  - Block Kit approval messages with Approve/Reject buttons
  - Slack signature verification for webhook security
  - `/tollgate pending` slash command
  - Fire-and-forget notifications via `asyncio.create_task()`
  - Expired message updates via background task
- **Latency**: Fire-and-forget pattern maintains <50ms p50 (measured 6.2ms p50 with Slack integration)
- **Migration**: `004_add_slack_integration.py` adds slack_integrations table and slack columns to approval_requests

## 2025-05-03: API Key Hashing Change

- **Change**: Switched API key hashing from bcrypt to HMAC-SHA256
- **Reason**: bcrypt verification (~100-200ms) caused /v1/check p50 latency to be ~390ms, far exceeding the <50ms target
- **Impact**: Existing API keys invalidated (pre-production, no real customers)
- **Notes**: User passwords still use bcrypt (correct for low-entropy secrets)
