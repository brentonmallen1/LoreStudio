"""A story is written as prose or as a screenplay

What the story is written as (doc 25): "prose", which every story so far is, or "screenplay",
whose scenes are written in script elements and measured in pages.

Revision ID: 0038_story_format
Revises: 0037_conversation_thinking
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038_story_format"
down_revision: str | None = "0037_conversation_thinking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("stories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("story_format", sa.String(), nullable=False, server_default="prose"))


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    op.execute("ALTER TABLE stories DROP COLUMN story_format")
