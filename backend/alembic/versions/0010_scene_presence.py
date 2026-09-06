"""scene_presence: the author's answer to "who is actually here"

Refactor doc 07 §3. Codex derives presence from point of view, attributed dialogue and
names in the prose, but only the author knows whether a name in a paragraph is someone in
the room or someone being talked about. That answer is authored data, so it belongs in the
Lorebook where snapshots, exports and undo can reach it — Codex reads it, and never stores
the only copy of it.

Revision ID: 0010_scene_presence
Revises: 0009_codex_graph
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_scene_presence"
down_revision: str | None = "0009_codex_graph"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scene_presence",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("character_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["structure_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("node_id", "character_id", name="uq_scene_presence"),
    )
    with op.batch_alter_table("scene_presence", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_scene_presence_character_id"), ["character_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_scene_presence_node_id"), ["node_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("scene_presence", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_scene_presence_node_id"))
        batch_op.drop_index(batch_op.f("ix_scene_presence_character_id"))
    op.drop_table("scene_presence")
