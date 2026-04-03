"""Add context_node_id to character_interviews

Revision ID: 006
Revises: 005
Create Date: 2026-04-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "character_interviews",
        sa.Column("context_node_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("character_interviews", "context_node_id")
