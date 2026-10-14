"""Import records: what an import brought, where it went, and what waits to be sorted (doc 28)

Every import through the wizard keeps a record: the source (Novelcrafter, a document, a
script), the original file as a story asset, each piece and the row it became, and what had
no place. What came with no home chosen waits as an imported item, shown in Proposals ›
Imported until the author places it, keeps it in the Compendium or declines it; the row stays
either way.

Revision ID: 0045_import_records
Revises: 0044_tropes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0045_import_records"
down_revision: str | None = "0044_tropes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "import_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("imported_at", sa.DateTime(), nullable=False),
        sa.Column("asset_id", sa.String(), nullable=True),
        sa.Column("manifest", sa.JSON(), nullable=False),
        sa.Column("left_out", sa.JSON(), nullable=False),
        sa.Column("nothing_set", sa.JSON(), nullable=False),
        sa.Column("not_in_file", sa.JSON(), nullable=False),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("import_records", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_import_records_story_id"), ["story_id"], unique=False)

    op.create_table(
        "imported_items",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("record_id", sa.String(), nullable=False),
        sa.Column("origin", sa.String(), nullable=False),
        sa.Column("origin_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("became_type", sa.String(), nullable=True),
        sa.Column("became_id", sa.String(), nullable=True),
        sa.Column("sorted_at", sa.DateTime(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["record_id"], ["import_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("imported_items", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_imported_items_record_id"), ["record_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_imported_items_story_id"), ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("imported_items", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_imported_items_story_id"))
        batch_op.drop_index(batch_op.f("ix_imported_items_record_id"))
    op.drop_table("imported_items")
    with op.batch_alter_table("import_records", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_import_records_story_id"))
    op.drop_table("import_records")
