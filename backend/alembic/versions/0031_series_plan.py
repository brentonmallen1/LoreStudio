"""Series plan: an arc across the books, what changes from book to book, each book's part

A series can be planned before its books are written (series v2): its arc is a list of
beats placed on the books that carry them, its axes say what changes from book to book (a
viewpoint character, an era, a place), and each book says its part in words and where it
stands on each axis. All of it optional, all of it defaulting to empty.

Revision ID: 0031_series_plan
Revises: 0030_series_scene_links
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031_series_plan"
down_revision: str | None = "0030_series_scene_links"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("series", schema=None) as batch_op:
        batch_op.add_column(sa.Column("arc", sa.JSON(), server_default="[]", nullable=False))
        batch_op.add_column(sa.Column("axes", sa.JSON(), server_default="[]", nullable=False))
    with op.batch_alter_table("series_stories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("role", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("slots", sa.JSON(), server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("arc_beats", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("series_stories", schema=None) as batch_op:
        batch_op.drop_column("arc_beats")
        batch_op.drop_column("slots")
        batch_op.drop_column("role")
    with op.batch_alter_table("series", schema=None) as batch_op:
        batch_op.drop_column("axes")
        batch_op.drop_column("arc")
