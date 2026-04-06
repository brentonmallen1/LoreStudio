"""Add attributes column to characters

Revision ID: 016
Revises: 015
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("characters", sa.Column("attributes", sa.JSON(), nullable=True))
    op.execute("UPDATE characters SET attributes = '{}' WHERE attributes IS NULL")


def downgrade() -> None:
    op.drop_column("characters", "attributes")
