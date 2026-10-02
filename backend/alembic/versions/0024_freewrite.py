"""Freewrite (doc 15 N3)

- stories.freewrite: the story's Freewrite page, HTML from the editor. Loose thinking goes
  here; a sentence made into a note, a character or a place keeps a ``data-made`` mark.
- stories.idea_fragments goes. Its unsorted pieces become notes of kind "idea", tied to
  nothing; sorted ones already became what they were filed as.

Revision ID: 0024_freewrite
Revises: 0023_notes
"""

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0024_freewrite"
down_revision: str | None = "0023_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTES = sa.table(
    "notes",
    sa.column("id", sa.String),
    sa.column("story_id", sa.String),
    sa.column("kind", sa.String),
    sa.column("content", sa.Text),
    sa.column("answer", sa.Text),
    sa.column("done", sa.Boolean),
    sa.column("position", sa.Integer),
    sa.column("created_at", sa.DateTime),
    sa.column("updated_at", sa.DateTime),
)


def _when(value: object, fallback: datetime) -> datetime:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return fallback
    return fallback


def upgrade() -> None:
    conn = op.get_bind()
    op.add_column("stories", sa.Column("freewrite", sa.Text(), server_default="", nullable=False))

    now = datetime.now(UTC).replace(tzinfo=None)
    taken = {row[0] for row in conn.execute(sa.text("SELECT id FROM notes"))}
    rows = []
    for story_id, raw in conn.execute(sa.text("SELECT id, idea_fragments FROM stories")):
        try:
            pieces = json.loads(raw) if isinstance(raw, str) else (raw or [])
        except ValueError:
            pieces = []
        for i, piece in enumerate(pieces if isinstance(pieces, list) else []):
            text = (piece.get("text") or "").strip() if isinstance(piece, dict) else ""
            if not text or piece.get("filed"):
                continue
            note_id = piece.get("id") or str(uuid.uuid4())
            if note_id in taken:
                note_id = str(uuid.uuid4())
            taken.add(note_id)
            when = _when(piece.get("created_at"), now)
            rows.append(
                {
                    "id": note_id,
                    "story_id": story_id,
                    "kind": "idea",
                    "content": text,
                    "answer": "",
                    "done": False,
                    "position": i,
                    "created_at": when,
                    "updated_at": when,
                }
            )
    if rows:
        op.bulk_insert(NOTES, rows)
    # In place, as 0023 did: a batch rebuild of stories would DROP the table everything
    # else points at.
    op.execute("ALTER TABLE stories DROP COLUMN idea_fragments")


def downgrade() -> None:
    conn = op.get_bind()
    op.add_column("stories", sa.Column("idea_fragments", sa.JSON(), server_default="[]", nullable=False))
    ideas: dict[str, list[dict]] = {}
    for note_id, story_id, content, created in conn.execute(
        sa.text("SELECT id, story_id, content, created_at FROM notes WHERE kind = 'idea'")
    ):
        ideas.setdefault(story_id, []).append(
            {"id": note_id, "text": content, "created_at": str(created), "filed": None}
        )
    for story_id, pieces in ideas.items():
        conn.execute(
            sa.text("UPDATE stories SET idea_fragments = :p WHERE id = :id"),
            {"p": json.dumps(pieces), "id": story_id},
        )
    conn.execute(sa.text("DELETE FROM notes WHERE kind = 'idea'"))
    op.execute("ALTER TABLE stories DROP COLUMN freewrite")
