# Tollgate Build Log

Notable technical decisions and changes during development.

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
