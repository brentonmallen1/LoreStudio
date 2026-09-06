"""ai_call_payloads: the prose half of the AI call log

Refactor doc 06 §3. The summary of every call stays in activity_logs; the prompt,
messages, raw response, thinking and options move here so the activity list stays light
and payloads can be pruned on their own retention schedule.

Revision ID: 0005_ai_call_payloads
Revises: 0004_changes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_ai_call_payloads"
down_revision: str | None = "0004_changes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_call_payloads",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("activity_log_id", sa.String(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("messages", sa.JSON(), nullable=False),
        sa.Column("raw_response", sa.Text(), nullable=False),
        sa.Column("thinking", sa.Text(), nullable=True),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("response_format", sa.JSON(), nullable=True),
        sa.Column("context_sources", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_log_id"], ["activity_logs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ai_call_payloads", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ai_call_payloads_activity_log_id"), ["activity_log_id"], unique=True
        )
        batch_op.create_index(batch_op.f("ix_ai_call_payloads_created_at"), ["created_at"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("ai_call_payloads", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_ai_call_payloads_created_at"))
        batch_op.drop_index(batch_op.f("ix_ai_call_payloads_activity_log_id"))
    op.drop_table("ai_call_payloads")
