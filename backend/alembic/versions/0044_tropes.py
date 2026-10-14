"""Tropes in play: where a trope applies and what the author does with it (doc 27)

A trope is a row with a stance (undecided, straight, subverted, inverted, averted,
deconstructed, lampshaded) and the author's why. Its links say where it plays: a character, a
relationship or a scene, one target per link; a trope with none applies to the whole story.
The thread that tracks it and the Compendium entry holding its definition are plain ids, as
`era_id`: undoing their delete brings the link back, and a missing one reads as none.

Revision ID: 0044_tropes
Revises: 0043_adapted_from
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0044_tropes"
down_revision: str | None = "0043_adapted_from"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tropes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("stance", sa.String(), nullable=False),
        sa.Column("why", sa.Text(), nullable=False),
        sa.Column("thread_id", sa.String(), nullable=True),
        sa.Column("definition_id", sa.String(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("tropes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tropes_story_id"), ["story_id"], unique=False)

    op.create_table(
        "trope_links",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("trope_id", sa.String(), nullable=False),
        sa.Column("character_id", sa.String(), nullable=True),
        sa.Column("relationship_id", sa.String(), nullable=True),
        sa.Column("node_id", sa.String(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "(character_id IS NOT NULL) + (relationship_id IS NOT NULL) + (node_id IS NOT NULL) = 1",
            name="ck_trope_links_one_target",
        ),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["structure_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["relationship_id"], ["character_relationships.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trope_id"], ["tropes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("trope_links", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_trope_links_character_id"), ["character_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_trope_links_node_id"), ["node_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_trope_links_relationship_id"), ["relationship_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_trope_links_trope_id"), ["trope_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("trope_links", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_trope_links_trope_id"))
        batch_op.drop_index(batch_op.f("ix_trope_links_relationship_id"))
        batch_op.drop_index(batch_op.f("ix_trope_links_node_id"))
        batch_op.drop_index(batch_op.f("ix_trope_links_character_id"))
    op.drop_table("trope_links")
    with op.batch_alter_table("tropes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tropes_story_id"))
    op.drop_table("tropes")
