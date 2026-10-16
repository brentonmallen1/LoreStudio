"""A scene can hold several takes: whole-scene versions of its prose (doc 29 D7)

The take that counts is the scene's prose everywhere, so it stays in ``structure_nodes.content``
and every reader of the prose keeps working. The other takes are rows here. A scene with one
take has no rows; "Try another version" makes two, the first standing for the prose that counts
(``counts``, its own ``content`` left empty). ``is_open`` is the take the editor shows.

Revision ID: 0049_scene_takes
Revises: 0048_beat_boards_to_tray
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0049_scene_takes"
down_revision: str | None = "0048_beat_boards_to_tray"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scene_takes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), server_default="", nullable=False),
        sa.Column("content", sa.Text(), server_default="", nullable=False),
        sa.Column("word_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("counts", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("is_open", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["node_id"], ["structure_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("scene_takes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_scene_takes_node_id"), ["node_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("scene_takes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_scene_takes_node_id"))
    op.drop_table("scene_takes")
