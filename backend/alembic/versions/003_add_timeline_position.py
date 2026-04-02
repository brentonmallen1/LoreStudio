"""Add timeline_position to structure_nodes

Revision ID: 003
Revises: 002
Create Date: 2026-04-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "structure_nodes",
        sa.Column("timeline_position", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("structure_nodes", "timeline_position")
