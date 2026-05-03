"""Add policies and approval_requests tables.

Revision ID: 002
Revises: 001
Create Date: 2025-01-02 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create approval_status enum
    approval_status = postgresql.ENUM(
        "pending", "approved", "rejected", "expired",
        name="approval_status",
        create_type=False,
    )
    approval_status.create(op.get_bind(), checkfirst=True)

    # Create policies table
    op.create_table(
        "policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("source_yaml", sa.Text, nullable=False),
        sa.Column("parsed_json", postgresql.JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create indexes for policies
    op.create_index("ix_policies_agent_active", "policies", ["agent_id", "is_active"])

    # Create approval_requests table
    op.create_table(
        "approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "action_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("actions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("approvers_config", postgresql.JSONB, nullable=False),
        sa.Column("status", approval_status, nullable=False, server_default="pending"),
        sa.Column(
            "decided_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create indexes for approval_requests
    op.create_index(
        "ix_approval_requests_status_expires",
        "approval_requests",
        ["status", "expires_at"],
    )


def downgrade() -> None:
    # Drop tables
    op.drop_table("approval_requests")
    op.drop_table("policies")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS approval_status")
