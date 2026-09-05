"""Promote purpose and inline_notes out of structure_nodes.metadata.

Revision ID: 0002_purpose_notes
Revises: 0001_baseline
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_purpose_notes"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("structure_nodes") as batch:
        batch.add_column(sa.Column("purpose", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("inline_notes", sa.JSON(), nullable=True))
    # Copy existing values out of the JSON column, then drop the keys there.
    op.execute(
        "UPDATE structure_nodes SET purpose = COALESCE(json_extract(metadata, '$.purpose'), '') "
        "WHERE metadata IS NOT NULL AND json_type(metadata, '$.purpose') = 'text'"
    )
    op.execute(
        "UPDATE structure_nodes SET inline_notes = json_extract(metadata, '$.inline_notes') "
        "WHERE metadata IS NOT NULL AND json_type(metadata, '$.inline_notes') = 'array'"
    )
    op.execute("UPDATE structure_nodes SET inline_notes = '[]' WHERE inline_notes IS NULL")
    op.execute(
        "UPDATE structure_nodes SET metadata = json_remove(metadata, '$.purpose', '$.inline_notes') "
        "WHERE metadata IS NOT NULL AND json_valid(metadata)"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE structure_nodes SET metadata = json_set(COALESCE(metadata, '{}'), "
        "'$.purpose', purpose, '$.inline_notes', json(COALESCE(inline_notes, '[]')))"
    )
    with op.batch_alter_table("structure_nodes") as batch:
        batch.drop_column("inline_notes")
        batch.drop_column("purpose")
