"""Switch API key hashing from bcrypt to HMAC-SHA256.

Revision ID: 003
Revises: 002
Create Date: 2025-05-03

IMPORTANT: This migration invalidates all existing API keys.
Any agents created before this migration will need to be recreated
to obtain new API keys that use HMAC-SHA256 hashing.

Reason for change:
- bcrypt verification takes ~100-200ms per request
- HMAC-SHA256 verification takes <1ms
- This is required to meet <50ms p50 latency target for /v1/check
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add index on api_key_prefix for faster lookup
    # The lookup strategy is: prefix -> agent row -> HMAC verify
    op.create_index("ix_agents_api_key_prefix", "agents", ["api_key_prefix"])

    # Note: Existing API keys are invalidated because:
    # 1. They were hashed with bcrypt (60-char hash starting with $2b$)
    # 2. New keys are hashed with HMAC-SHA256 (64-char hex string)
    # 3. The verification function now expects HMAC format
    #
    # Pre-production: No real customers affected.
    # Agents created before this migration must be recreated.


def downgrade() -> None:
    op.drop_index("ix_agents_api_key_prefix", table_name="agents")
