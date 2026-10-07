"""Jobs: lanes, order, who started them, unseen and retried (doc 21)

The job queue gains two lanes (the model, and local work that never waits behind it), an
order within each lane so Run next can move a job to the front, who started a job and
whether it is quiet automatic work, what it is doing now, when the author saw it finished,
the job a retry repeats and how many restarts interrupted it. Existing local kinds move to
the local lane; jobs already finished count as seen, so nobody returns to a dot for last
month's work.

Revision ID: 0035_job_lanes
Revises: 0034_who_are_they
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035_job_lanes"
down_revision: str | None = "0034_who_are_they"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = ("lane", "position", "origin", "origin_note", "quiet", "step_label", "seen_at", "retry_of", "attempts")


def upgrade() -> None:
    with op.batch_alter_table("ai_jobs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("lane", sa.String(), server_default="model", nullable=False))
        batch_op.add_column(sa.Column("position", sa.Float(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("origin", sa.String(), server_default="author", nullable=False))
        batch_op.add_column(sa.Column("origin_note", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("quiet", sa.Boolean(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("step_label", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("seen_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("retry_of", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("attempts", sa.Integer(), server_default="0", nullable=False))
    op.execute("UPDATE ai_jobs SET lane = 'local' WHERE kind IN ('codex-sync', 'numbers-backfill')")
    op.execute("UPDATE ai_jobs SET seen_at = finished_at WHERE finished_at IS NOT NULL")
    # Queued jobs keep their order: the position is the time they were asked for.
    op.execute("UPDATE ai_jobs SET position = CAST(strftime('%s', created_at) AS REAL)")


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    for name in COLUMNS[::-1]:
        op.execute(f"ALTER TABLE ai_jobs DROP COLUMN {name}")
