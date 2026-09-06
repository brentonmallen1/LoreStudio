"""character_interviews.knowledge_scope: profile / story / as_of

Refactor doc 06 §6. An interview needs to say which of three things it is: a conversation
outside the story (the character is only their profile), one that draws on everything
written so far, or one pinned to a point in the story. Before this, a null context_node_id
meant "no story context" by accident.

Existing rows keep exactly the behaviour they had: pinned interviews become "as_of",
everything else becomes "profile".

Revision ID: 0006_interview_knowledge_scope
Revises: 0005_ai_call_payloads
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_interview_knowledge_scope"
down_revision: str | None = "0005_ai_call_payloads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("character_interviews", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("knowledge_scope", sa.String(), nullable=False, server_default="profile")
        )
    op.execute("UPDATE character_interviews SET knowledge_scope = 'as_of' WHERE context_node_id IS NOT NULL")


def downgrade() -> None:
    with op.batch_alter_table("character_interviews", schema=None) as batch_op:
        batch_op.drop_column("knowledge_scope")
