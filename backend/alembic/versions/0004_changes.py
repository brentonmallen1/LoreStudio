"""Change log for undo/redo.

Revision ID: 0004_changes
Revises: 0003_author_name
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_changes"
down_revision = "0003_author_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "changes",
        sa.Column("seq", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=True),
        sa.Column("batch_id", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("client_id", sa.String(), nullable=True),
        sa.Column("undoable", sa.Boolean(), nullable=False),
        sa.Column("undo_of", sa.String(), nullable=True),
        sa.Column("redo_of", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for col in ("story_id", "batch_id", "client_id", "undo_of", "redo_of", "created_at"):
        op.create_index(f"ix_changes_{col}", "changes", [col])


def downgrade() -> None:
    op.drop_table("changes")
