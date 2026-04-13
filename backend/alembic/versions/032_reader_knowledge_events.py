"""add reader_knowledge_events table

Revision ID: 032_reader_knowledge_events
Revises: 031_add_outline_scene_linking
Create Date: 2026-04-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "032_reader_knowledge_events"
down_revision: Union[str, None] = "031_add_outline_scene_linking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reader_knowledge_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("node_id", sa.String(), sa.ForeignKey("structure_nodes.id"), nullable=True),
        sa.Column("twist_id", sa.String(), sa.ForeignKey("twists.id"), nullable=True),
        sa.Column("knowledge_type", sa.String(), nullable=False, server_default="truth_revealed"),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False, server_default=""),
        sa.Column("reader_knows", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("characters_who_know", sa.JSON(), nullable=True),
        sa.Column("is_truth", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("supersedes_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_rke_story_id", "reader_knowledge_events", ["story_id"])
    op.create_index("ix_rke_node_id", "reader_knowledge_events", ["node_id"])


def downgrade() -> None:
    op.drop_index("ix_rke_node_id", table_name="reader_knowledge_events")
    op.drop_index("ix_rke_story_id", table_name="reader_knowledge_events")
    op.drop_table("reader_knowledge_events")
