# Tollgate Build Log

Notable technical decisions and changes during development.

## 2025-05-03: API Key Hashing Change

- **Change**: Switched API key hashing from bcrypt to HMAC-SHA256
- **Reason**: bcrypt verification (~100-200ms) caused /v1/check p50 latency to be ~390ms, far exceeding the <50ms target
- **Impact**: Existing API keys invalidated (pre-production, no real customers)
- **Notes**: User passwords still use bcrypt (correct for low-entropy secrets)
