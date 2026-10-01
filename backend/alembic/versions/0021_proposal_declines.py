"""Declined proposals (doc 12 P5)

Proposals are gathered on every read from what the app noticed: stub places, discoveries,
Codex suggestions, suggested relationships, names a scan found, dialogue with no speaker.
The first four have rows of their own to mark when the author answers; the last two are
recomputed from the prose and have nothing to mark, so "not this" is kept here by
fingerprint, with the scene's hash where there is one.

Revision ID: 0021_proposal_declines
Revises: 0020_finding_dismissals
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_proposal_declines"
down_revision: str | None = "0020_finding_dismissals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proposal_declines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("fingerprint", sa.String(), nullable=False),
        sa.Column("node_content_hash", sa.String(), nullable=True),
        sa.Column("declined_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", "fingerprint", name="uq_proposal_decline"),
    )
    with op.batch_alter_table("proposal_declines") as batch_op:
        batch_op.create_index(batch_op.f("ix_proposal_declines_story_id"), ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("proposal_declines") as batch_op:
        batch_op.drop_index(batch_op.f("ix_proposal_declines_story_id"))
    op.drop_table("proposal_declines")
