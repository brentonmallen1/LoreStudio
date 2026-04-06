"""Add starred column to activity_logs for Summary Archive

Revision ID: 015
Revises: 014
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "activity_logs",
        sa.Column("starred", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("activity_logs", "starred")
