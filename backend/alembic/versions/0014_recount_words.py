"""structure_nodes.word_count: recount from the prose

The stored count is what the structure tree shows; the editor counts live as the author
types. They used different rules — the demo seed wrote its counts in by hand, off by up
to 49 words a scene — so a scene's count jumped the first time it was touched. This
recounts every node once by the editor's rule. It is derived data: nothing the author
wrote is changed, and a scene they have already edited recounts to the number it has.

The counting rule is copied rather than imported, so this migration keeps doing what it
did when it was written even if the app's version changes.

Revision ID: 0014_recount_words
Revises: 0013_codex_edge_per_source
"""

import html
import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_recount_words"
down_revision: str | None = "0013_codex_edge_per_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BLOCK_TAG = re.compile(r"</?(?:p|h[1-6]|li|ul|ol|blockquote|pre|div|br|hr)\b[^>]*>", re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")


def _count(content_html: str | None) -> int:
    text = _TAG.sub("", _BLOCK_TAG.sub(" ", content_html or ""))
    return len(_TAG.sub("", html.unescape(text)).split())


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, content, word_count FROM structure_nodes")).fetchall()
    for node_id, content, stored in rows:
        n = _count(content)
        if n != stored:
            conn.execute(sa.text("UPDATE structure_nodes SET word_count = :n WHERE id = :id"), {"n": n, "id": node_id})


def downgrade() -> None:
    # The old numbers were wrong; there is nothing worth restoring.
    pass
