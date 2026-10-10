"""A script's title page

What a screenplay's title page says beyond the title and the byline (doc 25, P3): the credit
("Written by"), what it is based on, the contact block, the draft and its date.

Revision ID: 0041_title_page
Revises: 0040_scene_heading
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0041_title_page"
down_revision: str | None = "0040_scene_heading"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Native ADD COLUMN: the batch form rebuilds the table for this default, and a rebuild drops
    # `stories` under foreign_keys=ON.
    op.add_column("stories", sa.Column("title_page", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    op.execute("ALTER TABLE stories DROP COLUMN title_page")
