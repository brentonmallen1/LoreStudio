"""characters.flaws / quirks / speech_patterns: what makes a character particular

Writer-mode polish (writer-audit.md B8). Quirks, flaws and speech patterns existed only as
AI attribute suggestions, so an author without AI had nowhere to write them. Plain text,
empty by default; the interview persona and the context assembler read them.

Revision ID: 0015_character_flaws_quirks_speech
Revises: 0014_recount_words
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_character_flaws_quirks_speech"
down_revision: str | None = "0014_recount_words"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("characters", schema=None) as batch_op:
        batch_op.add_column(sa.Column("flaws", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("quirks", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("speech_patterns", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("characters", schema=None) as batch_op:
        batch_op.drop_column("speech_patterns")
        batch_op.drop_column("quirks")
        batch_op.drop_column("flaws")
