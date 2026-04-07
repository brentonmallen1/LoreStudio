"""Add stub/discovery provenance fields to locations

Revision ID: 017
Revises: 016
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("is_stub", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("locations", sa.Column("discovered_from_id", sa.String(), nullable=True))
    op.add_column("locations", sa.Column("discovered_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("locations", "discovered_at")
    op.drop_column("locations", "discovered_from_id")
    op.drop_column("locations", "is_stub")
