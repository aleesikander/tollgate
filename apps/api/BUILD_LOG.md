# Tollgate Build Log

## 2026-05-04: Python SDK (Prompt 4)

- **Package**: `packages/sdk-python/` — `tollgate-sdk`, Python 3.10+
- **Core patterns**: `@tg.guard()` decorator, `with tg.check()` context manager, explicit `tg.check_action()`
- **Pending polling**: polls `GET /v1/check/{action_id}` every 2s; handles `approved`/`rejected`/`expired` responses
- **`fail_open`**: network errors either raise `TollgateConnectionError` (default) or allow through with warning log
- **Async**: `AsyncTollgate` mirrors sync client with `httpx.AsyncClient` and `asyncio.sleep`
- **Tests**: 28 tests, all passing, respx HTTP mocking, mypy strict clean
- **Example**: `packages/sdk-python/examples/support_agent.py` — Claude-backed support agent with 3 guarded tools

## 2026-05-05: TypeScript SDK (Prompt 6)

- **Package**: `packages/sdk-typescript/` — `@tollgate/sdk`, Node 18+
- **Core patterns**: `tg.guard()` wrapper with optional payload mapper, `tg.checkAction()` explicit, `tg.withCheck()` context wrapper
- **Build**: tsup dual ESM/CJS + `.d.ts` declarations
- **Tests**: 28 tests, all passing, msw v2 HTTP mocking, zero type errors
- **Example**: `packages/sdk-typescript/examples/support-agent.ts` — Claude-backed support agent with 3 guarded tools

Fixed TypeScript SDK package name from `tollgate-sdk` to `@tollgate/sdk` per Prompt 6 spec.
Fixed SDK public API class names to match Prompt 6 spec: `Tollgate` (not `TollgateClient`), `ActionDenied` (not `ActionDeniedError`), `ActionPending` (not `ActionPendingError`). Both Python and TypeScript SDKs.
Fixed TypeScript SDK missing auto-generated idempotency_key — every /v1/check call was failing with 422. Also fixed response field mismatch: API returns `action_id` but SDK was reading `.id` (breaking polling). Added integration test files in both SDKs for future regression coverage.

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
