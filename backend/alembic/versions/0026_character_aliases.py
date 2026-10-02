"""Character aliases

The other names a character answers to in the prose ("@Tom" for Thomas Vance), as places
have had since 0022. A mention that names nobody can be pointed at someone from the
editor, and a rename keeps the old name while the prose still uses it.

Revision ID: 0026_character_aliases
Revises: 0025_scratch_pad
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026_character_aliases"
down_revision: str | None = "0025_scratch_pad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # In place: rebuilding characters trips the foreign keys that point at it.
    op.add_column("characters", sa.Column("aliases", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.execute("ALTER TABLE characters DROP COLUMN aliases")
