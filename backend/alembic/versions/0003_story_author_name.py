"""Add stories.author_name (byline for exports).

Revision ID: 0003_author_name
Revises: 0002_purpose_notes
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_author_name"
down_revision = "0002_purpose_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.add_column(sa.Column("author_name", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.drop_column("author_name")
