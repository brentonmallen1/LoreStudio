"""A line of dialogue keeps its direction

A screenplay's parenthetical, "(quietly)", read with the line it comes before (doc 25, P4).
Prose lines have none.

Revision ID: 0042_dialogue_direction
Revises: 0041_title_page
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0042_dialogue_direction"
down_revision: str | None = "0041_title_page"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Native ADD COLUMN, as 0041: no table rebuild under foreign_keys=ON.
    op.add_column("dialogue_blocks", sa.Column("direction", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    op.execute("ALTER TABLE dialogue_blocks DROP COLUMN direction")
