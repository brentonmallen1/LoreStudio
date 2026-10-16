"""A story remembers how its writer likes to work

New Story asks once (doc 29 D1): plan first ("plan"), find it while writing ("discover"), or
a bit of both ("both"). It decides where the story opens and the Overview's next step, never
what is available. Older stories keep "" and the Overview they had.

Revision ID: 0047_working_style
Revises: 0046_assistant_results
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0047_working_style"
down_revision: str | None = "0046_assistant_results"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Native ADD COLUMN, as 0041 and 0043: no table rebuild under foreign_keys=ON.
    op.add_column("stories", sa.Column("working_style", sa.String(), server_default="", nullable=False))


def downgrade() -> None:
    op.execute("ALTER TABLE stories DROP COLUMN working_style")
