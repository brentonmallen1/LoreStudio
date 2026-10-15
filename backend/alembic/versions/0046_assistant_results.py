"""Kept Assistant answers (A6): a one-shot answer stays on the sheet it was asked from

One row per thing and feature (a place's "Brainstorm what exists", a thread's analysis):
asking again replaces it, Clear deletes it, and deleting the story or the thing takes it.

Revision ID: 0046_assistant_results
Revises: 0045_import_records
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0046_assistant_results"
down_revision: str | None = "0045_import_records"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assistant_results",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("subject_type", sa.String(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=False),
        sa.Column("feature", sa.String(), nullable=False),
        sa.Column("heading", sa.String(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("ai_call_log_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", "subject_type", "subject_id", "feature", name="uq_assistant_result"),
    )
    with op.batch_alter_table("assistant_results", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_assistant_results_story_id"), ["story_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_assistant_results_subject_id"), ["subject_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("assistant_results", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_assistant_results_subject_id"))
        batch_op.drop_index(batch_op.f("ix_assistant_results_story_id"))
    op.drop_table("assistant_results")
