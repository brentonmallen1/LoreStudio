"""Add character_journey_summaries table

Revision ID: 005
Revises: 004
Create Date: 2026-04-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    if "character_journey_summaries" not in inspector.get_table_names():
        op.create_table(
            "character_journey_summaries",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("character_id", sa.String(), nullable=False),
            sa.Column("up_to_node_id", sa.String(), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("source_node_ids", sa.Text(), nullable=False, server_default=""),
            sa.Column("is_stale", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["up_to_node_id"], ["structure_nodes.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    op.drop_table("character_journey_summaries")
