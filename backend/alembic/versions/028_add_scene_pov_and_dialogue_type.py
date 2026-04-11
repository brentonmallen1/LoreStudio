"""Add pov_character_id to structure_nodes and dialogue_type to dialogue_blocks.

Revision ID: 028
Revises: 027
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # 1. Add pov_character_id to structure_nodes
    node_cols = {c["name"] for c in inspector.get_columns("structure_nodes")}
    if "pov_character_id" not in node_cols:
        with op.batch_alter_table("structure_nodes") as batch_op:
            batch_op.add_column(
                sa.Column("pov_character_id", sa.String(), nullable=True)
            )

    # 2. Add dialogue_type to dialogue_blocks
    dlg_cols = {c["name"] for c in inspector.get_columns("dialogue_blocks")}
    if "dialogue_type" not in dlg_cols:
        with op.batch_alter_table("dialogue_blocks") as batch_op:
            batch_op.add_column(
                sa.Column("dialogue_type", sa.String(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("dialogue_blocks") as batch_op:
        batch_op.drop_column("dialogue_type")

    with op.batch_alter_table("structure_nodes") as batch_op:
        batch_op.drop_column("pov_character_id")
