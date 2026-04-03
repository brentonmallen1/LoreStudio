"""Add content_summary and summary_stale to structure_nodes

Revision ID: 004
Revises: 003
Create Date: 2026-04-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "structure_nodes",
        sa.Column("content_summary", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "structure_nodes",
        sa.Column("summary_stale", sa.Boolean(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("structure_nodes", "summary_stale")
    op.drop_column("structure_nodes", "content_summary")
