"""Add twists table

Revision ID: 020
Revises: 019
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "twists",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("the_truth", sa.Text(), nullable=False, server_default=""),
        sa.Column("the_misdirection", sa.Text(), nullable=False, server_default=""),
        sa.Column("twist_type", sa.String(), nullable=False, server_default="reveal"),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),
        sa.Column("revealed_at_node_id", sa.String(), sa.ForeignKey("structure_nodes.id"), nullable=True),
        sa.Column("clues", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_twists_story_id", "twists", ["story_id"])


def downgrade() -> None:
    op.drop_index("ix_twists_story_id", table_name="twists")
    op.drop_table("twists")
