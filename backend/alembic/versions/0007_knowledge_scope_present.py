"""Rename the "story" interview scope to "present", and allow "omniscient"

"story" read as omniscient but never was: it means every scene the character was present
for, across the whole manuscript. The value is renamed to say that, and a fourth scope —
"omniscient" — now exists for the hypothetical the old label implied, where the author
shows the character scenes they were never in.

Revision ID: 0007_knowledge_scope_present
Revises: 0006_interview_knowledge_scope
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007_knowledge_scope_present"
down_revision: str | None = "0006_interview_knowledge_scope"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE character_interviews SET knowledge_scope = 'present' WHERE knowledge_scope = 'story'")


def downgrade() -> None:
    op.execute("UPDATE character_interviews SET knowledge_scope = 'story' WHERE knowledge_scope = 'present'")
    # An omniscient interview has no pre-0007 equivalent; presence is the safe reading.
    op.execute("UPDATE character_interviews SET knowledge_scope = 'story' WHERE knowledge_scope = 'omniscient'")
