"""Add beat_sheets table, beat_sheet_id on stories, beat_id on structure_nodes

Revision ID: 013
Revises: 012
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "beat_sheets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("beats", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column("stories", sa.Column("beat_sheet_id", sa.String(), nullable=True))
    op.add_column("structure_nodes", sa.Column("beat_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("structure_nodes", "beat_id")
    op.drop_column("stories", "beat_sheet_id")
    op.drop_table("beat_sheets")
