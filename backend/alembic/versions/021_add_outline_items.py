"""Add outline_items table

Revision ID: 021
Revises: 020
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outline_items",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("parent_id", sa.String(), sa.ForeignKey("outline_items.id"), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("beat_type", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("collapsed", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outline_items_story_id", "outline_items", ["story_id"])
    op.create_index("ix_outline_items_parent_id", "outline_items", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_outline_items_parent_id", table_name="outline_items")
    op.drop_index("ix_outline_items_story_id", table_name="outline_items")
    op.drop_table("outline_items")
