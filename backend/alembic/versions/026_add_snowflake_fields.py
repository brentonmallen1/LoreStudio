"""Add Snowflake Method fields to stories and characters.

Revision ID: 026
Revises: 025
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("stories") as batch_op:
        batch_op.add_column(sa.Column("snowflake_sentence", sa.Text(), nullable=True, server_default=""))
        batch_op.add_column(sa.Column("snowflake_paragraph", sa.Text(), nullable=True, server_default=""))
        batch_op.add_column(sa.Column("snowflake_synopsis", sa.Text(), nullable=True, server_default=""))

    with op.batch_alter_table("characters") as batch_op:
        batch_op.add_column(sa.Column("snowflake_summary", sa.Text(), nullable=True, server_default=""))
        batch_op.add_column(sa.Column("snowflake_synopsis", sa.Text(), nullable=True, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("stories") as batch_op:
        batch_op.drop_column("snowflake_sentence")
        batch_op.drop_column("snowflake_paragraph")
        batch_op.drop_column("snowflake_synopsis")

    with op.batch_alter_table("characters") as batch_op:
        batch_op.drop_column("snowflake_summary")
        batch_op.drop_column("snowflake_synopsis")
