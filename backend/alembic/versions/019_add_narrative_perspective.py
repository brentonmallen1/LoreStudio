"""Add narrative_perspective and pov_character_id to stories

Revision ID: 019
Revises: 018
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stories", sa.Column("narrative_perspective", sa.String(), server_default="", nullable=False))
    op.add_column("stories", sa.Column("pov_character_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("stories", "pov_character_id")
    op.drop_column("stories", "narrative_perspective")
