"""add character classification fields

Revision ID: 033_character_classification
Revises: 032_reader_knowledge_events
Create Date: 2026-04-13

Adds character_type (round/flat/dynamic/static/stock/symbolic),
jungian_archetype (12 Jungian archetypes), and narrative_archetype
(8 Hero's Journey archetypes) columns to the characters table.

Also migrates existing role values:
  supporting -> deuteragonist
  minor      -> tertiary
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "033_character_classification"
down_revision: Union[str, None] = "032_reader_knowledge_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("characters", sa.Column("character_type", sa.String(), nullable=False, server_default=""))
    op.add_column("characters", sa.Column("jungian_archetype", sa.String(), nullable=False, server_default=""))
    op.add_column("characters", sa.Column("narrative_archetype", sa.String(), nullable=False, server_default=""))

    # Migrate existing role values to new vocabulary
    op.execute("UPDATE characters SET role = 'deuteragonist' WHERE role = 'supporting'")
    op.execute("UPDATE characters SET role = 'tertiary' WHERE role = 'minor'")


def downgrade() -> None:
    # Restore old role values
    op.execute("UPDATE characters SET role = 'supporting' WHERE role = 'deuteragonist'")
    op.execute("UPDATE characters SET role = 'tertiary' WHERE role = 'minor'")

    op.drop_column("characters", "narrative_archetype")
    op.drop_column("characters", "jungian_archetype")
    op.drop_column("characters", "character_type")
