"""A script scene keeps its length in lines

How many lines of the printed page a screenplay scene takes (doc 25, services/script_syntax.py),
kept beside its word count so the strip, the Overview and Numbers can show it in eighths of a
page without laying the scene out again. Prose scenes keep 0.

Revision ID: 0039_scene_line_count
Revises: 0038_story_format
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039_scene_line_count"
down_revision: str | None = "0038_story_format"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("structure_nodes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("line_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    op.execute("ALTER TABLE structure_nodes DROP COLUMN line_count")
