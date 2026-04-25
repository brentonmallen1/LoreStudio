"""extend character relationships with strength, visibility, purpose, notes

Revision ID: 034_extend_character_relationships
Revises: 033_character_classification
Create Date: 2026-04-18

Extends the character_relationships table with:
- strength (JSON): multi-dimensional {trust, power, affection} 0-10
- visibility (str): "public" or "hidden"
- narrative_purpose (JSON): list of purpose tags
- notes (Text): freeform author notes
- is_suggested (bool): AI-suggested, pending acceptance
- suggestion_source (str): "profile" or "prose"
- created_at / updated_at timestamps
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = "034_extend_character_relationships"
down_revision: Union[str, None] = "033_character_classification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("character_relationships", sa.Column("strength", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("character_relationships", sa.Column("visibility", sa.String(), nullable=False, server_default="public"))
    op.add_column("character_relationships", sa.Column("narrative_purpose", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("character_relationships", sa.Column("notes", sa.Text(), nullable=False, server_default=""))
    op.add_column("character_relationships", sa.Column("is_suggested", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("character_relationships", sa.Column("suggestion_source", sa.String(), nullable=False, server_default=""))
    op.add_column("character_relationships", sa.Column("created_at", sa.DateTime(), nullable=True))
    op.add_column("character_relationships", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE character_relationships SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    op.execute("UPDATE character_relationships SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")


def downgrade() -> None:
    op.drop_column("character_relationships", "updated_at")
    op.drop_column("character_relationships", "created_at")
    op.drop_column("character_relationships", "suggestion_source")
    op.drop_column("character_relationships", "is_suggested")
    op.drop_column("character_relationships", "notes")
    op.drop_column("character_relationships", "narrative_purpose")
    op.drop_column("character_relationships", "visibility")
    op.drop_column("character_relationships", "strength")
