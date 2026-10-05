"""Scene when: an in-world date and an era for each scene

When a scene happens, in the story's own words, and the era it happens in. The era link
has no foreign key: a snapshot restore puts a book's scenes back before its eras, and a
scene whose era is gone simply has none, as a scene's beat does.

Revision ID: 0032_scene_when
Revises: 0031_series_plan
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032_scene_when"
down_revision: str | None = "0031_series_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("structure_nodes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("in_world_date", sa.String(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("era_id", sa.String(), nullable=True))


def downgrade() -> None:
    # Native DROP COLUMN: a batch rebuild drops and recreates the table, which foreign_keys=ON
    # refuses while other rows point at scenes.
    op.execute("ALTER TABLE structure_nodes DROP COLUMN era_id")
    op.execute("ALTER TABLE structure_nodes DROP COLUMN in_world_date")
