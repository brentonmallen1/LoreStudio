"""Who are they: gender, body and mind, how they take things, what formed them (doc 20)

A character gains the fields that say who a person is: identity (gender, how they present, sex,
age, orientation, languages, heritage, faith, family, money and class), how they think and how
they take things, the arc's need, lie and stakes, and two small lists, Body and mind and What
formed them. Every one optional and empty until written; existing text is not moved.

Revision ID: 0034_who_are_they
Revises: 0033_numbers_readings
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034_who_are_they"
down_revision: str | None = "0033_numbers_readings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SHORT = ("gender", "presentation", "sex", "age", "orientation", "languages")
TEXT = (
    "heritage",
    "faith",
    "family",
    "circumstances",
    "thinking",
    "sore_spots",
    "takes_personally",
    "shows_hurt",
    "copes",
    "holds_on",
    "need",
    "lie",
    "stakes",
)
LISTS = ("facets", "formative")


def upgrade() -> None:
    with op.batch_alter_table("characters", schema=None) as batch_op:
        for name in SHORT:
            batch_op.add_column(sa.Column(name, sa.String(), server_default="", nullable=False))
        for name in TEXT:
            batch_op.add_column(sa.Column(name, sa.Text(), server_default="", nullable=False))
        for name in LISTS:
            batch_op.add_column(sa.Column(name, sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    # Native DROP COLUMN: a batch rebuild drops and recreates the table, which foreign_keys=ON
    # refuses while other rows point at characters.
    for name in (*SHORT, *TEXT, *LISTS)[::-1]:
        op.execute(f"ALTER TABLE characters DROP COLUMN {name}")
