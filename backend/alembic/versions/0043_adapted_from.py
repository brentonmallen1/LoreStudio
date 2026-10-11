"""A script remembers the novel it adapts

A story adapted from a novel (doc 25, P10) keeps which novel, and each of its scenes which of
the novel's scenes it tells, so the novel's prose can be read beside the script. No foreign
keys, as `era_id`: a snapshot restore puts rows back in its own order, and a script whose
novel is gone simply has none.

Revision ID: 0043_adapted_from
Revises: 0042_dialogue_direction
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0043_adapted_from"
down_revision: str | None = "0042_dialogue_direction"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Native ADD COLUMN, as 0041: no table rebuild under foreign_keys=ON.
    op.add_column("stories", sa.Column("adapted_from_id", sa.String(), nullable=True))
    op.add_column("structure_nodes", sa.Column("adapted_from_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.execute("ALTER TABLE structure_nodes DROP COLUMN adapted_from_id")
    op.execute("ALTER TABLE stories DROP COLUMN adapted_from_id")
