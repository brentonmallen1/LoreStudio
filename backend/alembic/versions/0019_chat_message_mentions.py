"""What the author @mentioned, on the Chronicle message (doc 11 P6)

A mention adds something to the context a chat is given. The Chronicle keeps the
conversation; it should also keep what the author pointed at when they asked, or the
record of the exchange is missing the part that shaped the answer.

Revision ID: 0019_chat_message_mentions
Revises: 0018_color_slots
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_chat_message_mentions"
down_revision: str | None = "0018_color_slots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.add_column(sa.Column("mentioned_refs", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("chat_messages") as batch_op:
        batch_op.drop_column("mentioned_refs")
