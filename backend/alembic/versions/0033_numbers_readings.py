"""Numbers readings: the Numbers page's figures kept over time (doc 19)

A reading is a few KB of figures (words, each scene's length and cast, threads, dialogue shares,
prose, open findings), kept apart from snapshots so the history outlives their pruning. The
backup settings row gains the readings' clock: when the story was last open, and when it was
last checked for a daily reading.

Revision ID: 0033_numbers_readings
Revises: 0032_scene_when
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033_numbers_readings"
down_revision: str | None = "0032_scene_when"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "numbers_readings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("taken_at", sa.DateTime(), nullable=False),
        sa.Column("trigger", sa.String(), nullable=False),
        sa.Column("snapshot_id", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["snapshot_id"], ["story_snapshots.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("numbers_readings", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_numbers_readings_story_id"), ["story_id"], unique=False)

    with op.batch_alter_table("story_backup_settings", schema=None) as batch_op:
        batch_op.add_column(sa.Column("numbers_seen_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("numbers_checked_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Native DROP COLUMN, as 0032: a batch rebuild of a table other rows point at is refused
    # with foreign_keys=ON.
    op.execute("ALTER TABLE story_backup_settings DROP COLUMN numbers_checked_at")
    op.execute("ALTER TABLE story_backup_settings DROP COLUMN numbers_seen_at")
    with op.batch_alter_table("numbers_readings", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_numbers_readings_story_id"))
    op.drop_table("numbers_readings")
