"""Add mission_statement to characters.

Revision ID: 024
Revises: 023
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("characters") as batch_op:
        batch_op.add_column(sa.Column("mission_statement", sa.Text(), nullable=True, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("characters") as batch_op:
        batch_op.drop_column("mission_statement")
