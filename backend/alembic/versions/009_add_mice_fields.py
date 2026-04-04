"""Add MICE fields to plot_threads

Revision ID: 009
Revises: 008
Create Date: 2026-04-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plot_threads",
        sa.Column("mice_type", sa.String(), nullable=True),
    )
    op.add_column(
        "plot_threads",
        sa.Column("opens_at_node_id", sa.String(), nullable=True),
    )
    op.add_column(
        "plot_threads",
        sa.Column("closes_at_node_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plot_threads", "closes_at_node_id")
    op.drop_column("plot_threads", "opens_at_node_id")
    op.drop_column("plot_threads", "mice_type")
