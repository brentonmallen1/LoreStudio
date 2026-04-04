"""Add intended_length to stories

Revision ID: 007
Revises: 006
Create Date: 2026-04-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stories",
        sa.Column("intended_length", sa.String(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("stories", "intended_length")
