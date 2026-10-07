"""App-wide settings: automatic work (doc 22)

One key → JSON table for what belongs to this LoreStudio rather than to one author: which of
the work it does by itself runs and how often (Settings › Automatic work), and each task's
last run.

Revision ID: 0036_app_settings
Revises: 0035_job_lanes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036_app_settings"
down_revision: str | None = "0035_job_lanes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
