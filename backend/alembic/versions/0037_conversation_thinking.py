"""Conversations keep their Think first choice

A conversation's own choice of whether the model thinks before answering, made with Think first
in its composer: true or false, or null to follow its feature's default under Settings. Kept
on the Chronicle's record of the conversation, so a resumed one picks it up again.

Revision ID: 0037_conversation_thinking
Revises: 0036_app_settings
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037_conversation_thinking"
down_revision: str | None = "0036_app_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("chat_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("thinking", sa.Boolean(), nullable=True))


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    op.execute("ALTER TABLE chat_sessions DROP COLUMN thinking")
