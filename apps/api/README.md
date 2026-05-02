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

Response:
```json
{
  "decision": "allowed",
  "action_id": "uuid",
  "reason": "no policies configured"
}
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
