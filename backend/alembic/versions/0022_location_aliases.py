"""Location aliases (doc 13 P4)

"Same as…" merges a place found in the prose into one the author already has. The found
place's name stays on the one it joined, so the prose that calls it that still resolves.

Revision ID: 0022_location_aliases
Revises: 0021_proposal_declines
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_location_aliases"
down_revision: str | None = "0021_proposal_declines"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("locations") as batch_op:
        batch_op.add_column(sa.Column("aliases", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("locations") as batch_op:
        batch_op.drop_column("aliases")
