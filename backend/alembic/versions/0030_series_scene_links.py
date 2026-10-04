"""Series scene links: a setup in one book that pays off in another

The gun on the wall in Book 1 that fires in Book 3. A scene link joins two scenes of one
book; this joins scenes of two books of a series. The scene ids carry no foreign key (a
book's snapshot restores its scenes with the same ids), and no existing table changes.

Revision ID: 0030_series_scene_links
Revises: 0029_series
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030_series_scene_links"
down_revision: str | None = "0029_series"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "series_scene_links",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("series_id", sa.String(), nullable=False),
        sa.Column("source_story_id", sa.String(), nullable=False),
        sa.Column("source_node_id", sa.String(), nullable=False),
        sa.Column("target_story_id", sa.String(), nullable=False),
        sa.Column("target_node_id", sa.String(), nullable=False),
        sa.Column("link_type", sa.String(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_in_story_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.ForeignKeyConstraint(["source_story_id"], ["stories.id"]),
        sa.ForeignKeyConstraint(["target_story_id"], ["stories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("series_scene_links", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_series_scene_links_series_id"), ["series_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_series_scene_links_source_story_id"), ["source_story_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_series_scene_links_target_story_id"), ["target_story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("series_scene_links", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_series_scene_links_target_story_id"))
        batch_op.drop_index(batch_op.f("ix_series_scene_links_source_story_id"))
        batch_op.drop_index(batch_op.f("ix_series_scene_links_series_id"))
    op.drop_table("series_scene_links")
