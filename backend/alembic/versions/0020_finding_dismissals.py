"""Dismissed findings (doc 12 D4)

Findings are computed on every read: from local checks, from the story's data, and from
the Assistant runs the Chronicle already keeps. The one thing about them that has to be
stored is the author saying "it's intended", kept by the finding's fingerprint and, for a
finding in a scene, the hash of the scene as it was, so the dismissal lapses when the
scene changes.

Revision ID: 0020_finding_dismissals
Revises: 0019_chat_message_mentions
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_finding_dismissals"
down_revision: str | None = "0019_chat_message_mentions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "finding_dismissals",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("fingerprint", sa.String(), nullable=False),
        sa.Column("node_content_hash", sa.String(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", "fingerprint", name="uq_finding_dismissal"),
    )
    with op.batch_alter_table("finding_dismissals") as batch_op:
        batch_op.create_index(batch_op.f("ix_finding_dismissals_story_id"), ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("finding_dismissals") as batch_op:
        batch_op.drop_index(batch_op.f("ix_finding_dismissals_story_id"))
    op.drop_table("finding_dismissals")
