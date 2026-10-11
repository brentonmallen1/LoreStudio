"""A script scene keeps what its heading says

"INT. KEEPER'S COTTAGE - NIGHT": whether the camera is inside or out, and when (doc 25, D3).
Read from the scene's heading on each save; the place is the scene's primary setting.

Revision ID: 0040_scene_heading
Revises: 0039_scene_line_count
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0040_scene_heading"
down_revision: str | None = "0039_scene_line_count"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("structure_nodes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("interior", sa.String(), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("time_of_day", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    # Native DROP COLUMN, as 0034: a batch rebuild would drop the table under foreign_keys=ON.
    op.execute("ALTER TABLE structure_nodes DROP COLUMN time_of_day")
    op.execute("ALTER TABLE structure_nodes DROP COLUMN interior")
