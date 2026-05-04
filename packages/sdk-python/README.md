# tollgate-sdk

Python SDK for [Tollgate](https://tollgate.dev) — the policy and approval layer for AI agents.

## Install

```bash
pip install tollgate-sdk
```

## 5-minute quickstart

```python
from tollgate import Tollgate

tg = Tollgate(
    api_key="tg_live_...",
    base_url="http://localhost:8000",  # your Tollgate API
)

@tg.guard("issue_refund")
def issue_refund(amount: float, customer_id: str) -> dict:
    # Your actual refund logic here
    return {"refunded": amount, "customer": customer_id}

# Safe to call — Tollgate checks policy before executing
result = issue_refund(amount=50.0, customer_id="c_123")
```

When the policy says `require_approval`, the decorator blocks until a human approves or rejects in Slack.

## Usage patterns

### Decorator (recommended)

```python
@tg.guard("issue_refund")
def issue_refund(amount: float, customer_id: str) -> dict:
    return stripe.refund(amount=amount, customer=customer_id)
```

### Context manager

```python
with tg.check("issue_refund", {"amount": 500, "customer_id": "c_123"}):
    stripe.refund(amount=500, customer="c_123")
```

### Explicit

```python
decision = tg.check_action("issue_refund", {"amount": 500})
if decision.allowed:
    stripe.refund(...)
```

## Error handling

| Exception | When | How to handle |
|-----------|------|---------------|
| `ActionDenied` | Policy denied or human rejected | Abort the action, inform the user |
| `ActionPending` | Approval timed out | Retry later or escalate |
| `TollgateAuthError` | Invalid API key | Check your `api_key` |
| `TollgateConnectionError` | Can't reach Tollgate API | Check network; consider `fail_open=True` |

```python
from tollgate import ActionDenied, ActionPending, TollgateConnectionError

try:
    result = issue_refund(amount=500, customer_id="c_123")
except ActionDenied as e:
    print(f"Refund not allowed: {e.reason}")
except ActionPending as e:
    print(f"Timed out waiting for approval: {e.action_id}")
except TollgateConnectionError:
    print("Tollgate unreachable")
```

## fail_open

By default, if Tollgate is unreachable the SDK raises `TollgateConnectionError` (safe — nothing proceeds). Set `fail_open=True` to allow actions through when Tollgate is down:

```python
tg = Tollgate(api_key="...", fail_open=True)
```

**Risk:** If Tollgate is down, all actions proceed without policy checks. Only use `fail_open=True` when availability matters more than safety for your use case.

## Async usage

```python
from tollgate import AsyncTollgate

tg = AsyncTollgate(api_key="tg_live_...")

@tg.aguard("issue_refund")
async def issue_refund(amount: float, customer_id: str) -> dict:
    return await stripe_async.refund(amount=amount)

# In an async context:
result = await issue_refund(amount=50.0, customer_id="c_123")
```

## Configuration

```python
tg = Tollgate(
    api_key="tg_live_...",
    base_url="https://api.tollgate.dev",  # override for local dev
    poll_interval=2.0,   # seconds between approval polls
    max_wait=300.0,      # max seconds to wait for approval
    on_pending=lambda action_id: print(f"Waiting for approval: {action_id}"),
    fail_open=False,     # raise on network errors (default)
    timeout=10.0,        # HTTP request timeout
)
```

## Links

- [Dashboard](https://tollgate.dev)
- [Docs](https://docs.tollgate.dev)
- [API Reference](https://api.tollgate.dev/v1/docs)
