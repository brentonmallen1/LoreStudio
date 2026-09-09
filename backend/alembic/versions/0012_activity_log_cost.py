"""activity_logs.cost_usd: room for what a call costs

Review §1.6. `_log_call` records tokens and latency but no cost — correct for a local
Ollama, wrong the moment a hosted provider appears, and §1.5 makes that the intended
direction. Nullable, unset by every call today, and far cheaper to add now than to
backfill onto a populated table later.

Revision ID: 0012_activity_log_cost
Revises: 0011_codex_chunks
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_activity_log_cost"
down_revision: str | None = "0011_codex_chunks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("activity_logs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("cost_usd", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("activity_logs", schema=None) as batch_op:
        batch_op.drop_column("cost_usd")
