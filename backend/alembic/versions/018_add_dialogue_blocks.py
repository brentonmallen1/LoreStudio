"""Add dialogue_blocks table

Revision ID: 018
Revises: 017
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dialogue_blocks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scene_id", sa.String(), sa.ForeignKey("structure_nodes.id"), nullable=False),
        sa.Column("character_id", sa.String(), sa.ForeignKey("characters.id"), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("paragraph_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("position_in_paragraph", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attribution_method", sa.String(), nullable=False, server_default="unattributed"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("speaker_name", sa.String(), nullable=False, server_default=""),
        sa.Column("subtext", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dialogue_blocks_scene_id", "dialogue_blocks", ["scene_id"])
    op.create_index("ix_dialogue_blocks_character_id", "dialogue_blocks", ["character_id"])


def downgrade() -> None:
    op.drop_index("ix_dialogue_blocks_character_id", table_name="dialogue_blocks")
    op.drop_index("ix_dialogue_blocks_scene_id", table_name="dialogue_blocks")
    op.drop_table("dialogue_blocks")
