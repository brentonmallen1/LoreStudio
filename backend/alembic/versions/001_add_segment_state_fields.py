"""Add entry_state, exit_state, key_events to structure_nodes

Revision ID: 001
Revises:
Create Date: 2026-04-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("structure_nodes", sa.Column("entry_state", sa.Text(), nullable=False, server_default=""))
    op.add_column("structure_nodes", sa.Column("exit_state", sa.Text(), nullable=False, server_default=""))
    op.add_column("structure_nodes", sa.Column("key_events", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("structure_nodes", "key_events")
    op.drop_column("structure_nodes", "exit_state")
    op.drop_column("structure_nodes", "entry_state")
