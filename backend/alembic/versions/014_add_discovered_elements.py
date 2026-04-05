"""Add discovered_elements table and discovery settings on stories

Revision ID: 014
Revises: 013
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "discovered_elements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("element_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("source_node_id", sa.String(), sa.ForeignKey("structure_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_excerpt", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("merged_to_type", sa.String(), nullable=True),
        sa.Column("merged_to_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    # Discovery settings on stories
    op.add_column("stories", sa.Column("discovery_enabled", sa.Boolean(), nullable=False, server_default="1"))
    op.add_column("stories", sa.Column("discovery_auto_analyze", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("stories", sa.Column("discovery_element_types", sa.JSON(), nullable=False, server_default='["character", "setting", "relationship"]'))
    op.add_column("stories", sa.Column("discovery_min_confidence", sa.Float(), nullable=False, server_default="0.6"))


def downgrade() -> None:
    op.drop_column("stories", "discovery_min_confidence")
    op.drop_column("stories", "discovery_element_types")
    op.drop_column("stories", "discovery_auto_analyze")
    op.drop_column("stories", "discovery_enabled")
    op.drop_table("discovered_elements")
