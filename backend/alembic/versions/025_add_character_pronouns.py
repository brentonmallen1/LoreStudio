"""Add pronouns to characters.

Revision ID: 025
Revises: 024
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("characters") as batch_op:
        batch_op.add_column(sa.Column("pronouns", sa.String(), nullable=True, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("characters") as batch_op:
        batch_op.drop_column("pronouns")
