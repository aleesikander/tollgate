"""Add Slack integration table and approval_requests Slack columns.

Revision ID: 004
Revises: 003
Create Date: 2025-05-03

Adds:
- slack_integrations table for storing Slack workspace connections
- slack_channel and slack_message_ts columns to approval_requests
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create slack_integrations table
    op.create_table(
        "slack_integrations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("team_id", sa.String(50), nullable=False),
        sa.Column("team_name", sa.String(255), nullable=False),
        sa.Column("bot_token_encrypted", sa.Text(), nullable=False),
        sa.Column("bot_user_id", sa.String(50), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("installed_by_user_id", sa.UUID(), nullable=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["installed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id"),
        sa.UniqueConstraint("team_id"),
    )
    op.create_index("ix_slack_integrations_org_id", "slack_integrations", ["org_id"])

    # Add Slack columns to approval_requests
    op.add_column(
        "approval_requests",
        sa.Column("slack_channel", sa.String(100), nullable=True),
    )
    op.add_column(
        "approval_requests",
        sa.Column("slack_message_ts", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    # Remove Slack columns from approval_requests
    op.drop_column("approval_requests", "slack_message_ts")
    op.drop_column("approval_requests", "slack_channel")

    # Drop slack_integrations table
    op.drop_index("ix_slack_integrations_org_id", table_name="slack_integrations")
    op.drop_table("slack_integrations")
