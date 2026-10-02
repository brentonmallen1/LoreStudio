"""The scratch pad on the account (doc 15 N4)

users.scratch_pad: the scratch pad's HTML. It belongs to no story, and it used to live in
the browser's storage, so it did not follow the author to another device.

Revision ID: 0025_scratch_pad
Revises: 0024_freewrite
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_scratch_pad"
down_revision: str | None = "0024_freewrite"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("scratch_pad", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN scratch_pad")
