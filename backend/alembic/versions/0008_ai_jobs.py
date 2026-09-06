"""ai_jobs: long-running AI work, with progress and a stop button

Refactor doc 06 §8. Summarising a manuscript or running a whole-story analysis held a
request open for minutes with nothing to watch and no way to stop. The queue is a table so
a job interrupted by a restart is still visible afterwards.

Revision ID: 0008_ai_jobs
Revises: 0007_knowledge_scope_present
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_ai_jobs"
down_revision: str | None = "0007_knowledge_scope_present"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ai_jobs", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_ai_jobs_created_at"), ["created_at"], unique=False)
        batch_op.create_index(batch_op.f("ix_ai_jobs_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_ai_jobs_story_id"), ["story_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_ai_jobs_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("ai_jobs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_ai_jobs_user_id"))
        batch_op.drop_index(batch_op.f("ix_ai_jobs_story_id"))
        batch_op.drop_index(batch_op.f("ix_ai_jobs_status"))
        batch_op.drop_index(batch_op.f("ix_ai_jobs_created_at"))
    op.drop_table("ai_jobs")
