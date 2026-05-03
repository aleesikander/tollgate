# Tollgate API

Policy and approval layer for AI agents. This is the backend API service.

## Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Docker and Docker Compose

## Quick Start

### 1. Start Infrastructure

```bash
# From repo root
docker-compose up -d
```

This starts:
- PostgreSQL 16 on port 5432 (dev database)
- PostgreSQL 16 on port 5433 (test database)
- Redis 7 on port 6379

### 2. Install Dependencies

```bash
cd apps/api

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv sync --all-extras
```

### 3. Configure Environment

```bash
# Copy example env file
cp ../../.env.example .env

# Edit .env if needed (defaults work for local dev)
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. Run Tests

```bash
pytest
```

### 6. Start Development Server

```bash
uvicorn tollgate.main:app --reload
```

The API is now running at http://localhost:8000

## API Endpoints

### Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{"status": "healthy", "version": "0.1.0"}
```

### Sign Up (Create Organization + User)

```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123",
    "org_name": "My Company"
  }'
```

Response:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": "uuid",
  "org_id": "uuid"
}
```

### Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123"
  }'
```

### Create Agent

```bash
# Replace TOKEN with access_token from signup/login
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "Customer Service Bot"}'
```

Response (API key shown only once):
```json
{
  "id": "uuid",
  "name": "Customer Service Bot",
  "api_key": "tg_live_abc123...",
  "api_key_prefix": "tg_live_abc",
  "status": "active",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### List Agents

```bash
curl http://localhost:8000/agents \
  -H "Authorization: Bearer TOKEN"
```

### Disable Agent

```bash
curl -X DELETE http://localhost:8000/agents/AGENT_ID \
  -H "Authorization: Bearer TOKEN"
```

### Create Policy

```bash
curl -X POST http://localhost:8000/agents/AGENT_ID/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "source_yaml": "version: 1\nrules:\n  - action: issue_refund\n    when:\n      amount: { lte: 50 }\n    decide: allow\n  - action: issue_refund\n    when:\n      amount: { gt: 50, lte: 500 }\n    decide: require_approval\n    approvers: [\"#support-leads\"]\n  - action: delete_account\n    decide: deny\n    reason: \"Account deletion never allowed\"\ndefault: deny"
  }'
```

### List Policies

```bash
curl http://localhost:8000/agents/AGENT_ID/policies \
  -H "Authorization: Bearer TOKEN"
```

### Get Active Policy

```bash
curl http://localhost:8000/agents/AGENT_ID/policies/active \
  -H "Authorization: Bearer TOKEN"
```

### Rollback to Policy Version

```bash
curl -X POST http://localhost:8000/agents/AGENT_ID/policies/1/activate \
  -H "Authorization: Bearer TOKEN"
```

### Check Action (Agent API)

```bash
# Replace API_KEY with the agent's API key
curl -X POST http://localhost:8000/v1/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer API_KEY" \
  -d '{
    "action_name": "issue_refund",
    "payload": {"amount": 50.00, "currency": "USD", "customer_id": "cust_123"},
    "idempotency_key": "refund-cust123-20250101"
  }'
```

Possible responses:

**Allowed** (action proceeds):
```json
{
  "decision": "allowed",
  "action_id": "uuid",
  "reason": "matched rule for issue_refund"
}
```

**Denied** (action blocked):
```json
{
  "decision": "denied",
  "action_id": "uuid",
  "reason": "Account deletion never allowed"
}
```

**Pending** (requires approval):
```json
{
  "decision": "pending",
  "action_id": "uuid",
  "reason": "matched rule for issue_refund"
}
```

### Poll Action Status (Agent API)

When an action is pending, poll for the decision:

```bash
curl http://localhost:8000/v1/check/ACTION_ID \
  -H "Authorization: Bearer API_KEY"
```

Response:
```json
{
  "action_id": "uuid",
  "decision": "pending",
  "reason": "awaiting approval"
}
```

### Decide on Pending Action

Approve or reject a pending action (called by approvers):

```bash
curl -X POST http://localhost:8000/v1/actions/ACTION_ID/decide \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "user_id": "approver-user-uuid"
  }'
```

Response:
```json
{
  "action_id": "uuid",
  "decision": "approved"
}
```

## Policy YAML Format

Policies are defined in YAML and control what actions agents can perform.

### Structure

```yaml
version: 1
rules:
  - action: issue_refund
    when:
      amount: { lte: 50 }
    decide: allow
    reason: "Small refunds auto-approved"

  - action: issue_refund
    when:
      amount: { gt: 50, lte: 500 }
    decide: require_approval
    approvers: ["#support-leads"]

  - action: delete_account
    decide: deny
    reason: "Account deletion never allowed for agents"

default: deny
```

### Decision Types

- `allow` - Action proceeds immediately
- `deny` - Action is blocked
- `require_approval` - Action is pending until approved/rejected

### Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `status: { eq: "active" }` |
| `neq` | Not equals | `status: { neq: "banned" }` |
| `gt` | Greater than | `amount: { gt: 100 }` |
| `gte` | Greater than or equal | `amount: { gte: 100 }` |
| `lt` | Less than | `amount: { lt: 50 }` |
| `lte` | Less than or equal | `amount: { lte: 50 }` |
| `in` | In list | `country: { in: ["US", "CA"] }` |
| `not_in` | Not in list | `country: { not_in: ["CN", "RU"] }` |
| `contains` | Contains substring/element | `email: { contains: "@company.com" }` |
| `matches` | Regex match | `code: { matches: "^[A-Z]{3}\\d{3}$" }` |

### Nested Fields

Access nested payload fields with dot notation:

```yaml
when:
  user.role: { eq: "admin" }
```

### Multiple Conditions

All conditions in a `when` clause must match (AND logic):

```yaml
when:
  amount: { gt: 50, lte: 500 }
  country: { in: ["US", "CA"] }
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Common error codes:
- `INVALID_CREDENTIALS` - Wrong email/password
- `EMAIL_EXISTS` - Email already registered
- `INVALID_TOKEN` - JWT is invalid
- `TOKEN_EXPIRED` - JWT has expired
- `INVALID_API_KEY` - Agent API key is invalid or disabled
- `AGENT_NOT_FOUND` - Agent doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `INVALID_YAML` - Policy YAML syntax error
- `INVALID_VERSION` - Policy version must be 1
- `MISSING_ACTION` - Rule missing action field
- `INVALID_OPERATOR` - Unknown condition operator
- `NO_ACTIVE_POLICY` - No active policy for agent
- `POLICY_NOT_FOUND` - Policy version doesn't exist
- `ACTION_NOT_FOUND` - Action doesn't exist
- `NOT_PENDING` - Action already decided
- `EXPIRED` - Approval request has expired

## Development

### Type Checking

```bash
mypy src/
```

### Code Formatting

```bash
ruff check src/ tests/
ruff format src/ tests/
```

### Database Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback:
```bash
alembic downgrade -1
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://tollgate:tollgate@localhost:5432/tollgate` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `JWT_SECRET` | Secret for signing JWTs | (required in production) |
| `JWT_EXPIRY_DAYS` | JWT token expiry in days | `7` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `LOG_FORMAT` | Log format (`json` or `console`) | `json` |

## Architecture

```
src/tollgate/
├── main.py           # FastAPI app entry
├── config.py         # Settings (pydantic-settings)
├── logging.py        # Structured logging (structlog)
├── database.py       # Async SQLAlchemy setup
├── dependencies.py   # FastAPI dependencies
├── models/           # SQLAlchemy models
├── schemas/          # Pydantic request/response schemas
├── services/         # Business logic layer
├── routes/           # API route handlers
└── middleware/       # Auth middleware
```

Key design principles:
- **Service layer**: All business logic in services, not routes
- **Async everywhere**: Full async/await support
- **Structured logging**: JSON logs with structlog
- **Type hints**: Full type coverage, mypy-clean
