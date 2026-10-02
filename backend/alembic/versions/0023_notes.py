"""One note, four kinds (doc 15 N0)

Margin notes, to-dos, open questions and the unused story notes become rows of one table:

- story_todos becomes ``notes``. A row's kind is "note", "question", "todo" or "idea". It
  gains ``anchor`` (the passage a margin note sits beside), ``source`` and ``category`` (an
  editorial pass's notes), and loses ``doc_from``/``doc_to``: offsets into the prose went
  stale on every edit, and a passage is tied by the prose's own mark now.
- structure_nodes.inline_notes moves into rows (kind "note"), keeping each note's id, so the
  ``<span data-note-id>`` in the prose still names its row. The column goes.
- story_notes (no screen showed it since the refactor) moves into rows of kind "idea" where it
  had any words, and the table goes.

The story's idea fragments stay until Freewrite replaces them (N3).

Revision ID: 0023_notes
Revises: 0022_location_aliases
"""

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0023_notes"
down_revision: str | None = "0022_location_aliases"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTES = sa.table(
    "notes",
    sa.column("id", sa.String),
    sa.column("story_id", sa.String),
    sa.column("kind", sa.String),
    sa.column("content", sa.Text),
    sa.column("node_id", sa.String),
    sa.column("anchor", sa.Text),
    sa.column("answer", sa.Text),
    sa.column("done", sa.Boolean),
    sa.column("source", sa.String),
    sa.column("category", sa.String),
    sa.column("position", sa.Integer),
    sa.column("created_at", sa.DateTime),
    sa.column("updated_at", sa.DateTime),
)


def _json(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return value


def _when(value, fallback: datetime) -> datetime:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return fallback
    return value or fallback


def upgrade() -> None:
    conn = op.get_bind()
    op.rename_table("story_todos", "notes")
    with op.batch_alter_table("notes") as batch_op:
        batch_op.drop_index("ix_story_todos_node_id")
        batch_op.drop_index("ix_story_todos_story_id")
        batch_op.create_index(batch_op.f("ix_notes_node_id"), ["node_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_notes_story_id"), ["story_id"], unique=False)
        batch_op.alter_column("kind", existing_type=sa.String(), server_default="note")
        batch_op.add_column(sa.Column("anchor", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("source", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("category", sa.String(), nullable=True))
        batch_op.drop_column("doc_from")
        batch_op.drop_column("doc_to")

    now = datetime.now(UTC).replace(tzinfo=None)
    taken = {row[0] for row in conn.execute(sa.text("SELECT id FROM notes"))}
    rows: list[dict] = []

    def add(row: dict) -> None:
        if row["id"] in taken:
            row["id"] = str(uuid.uuid4())
        taken.add(row["id"])
        rows.append(row)

    for node_id, story_id, raw in conn.execute(
        sa.text("SELECT id, story_id, inline_notes FROM structure_nodes WHERE inline_notes IS NOT NULL")
    ):
        for i, note in enumerate(_json(raw) or []):
            if not isinstance(note, dict) or not (note.get("note") or "").strip():
                continue
            add(
                {
                    "id": note.get("id") or str(uuid.uuid4()),
                    "story_id": story_id,
                    "kind": "note",
                    "content": note["note"],
                    "node_id": node_id,
                    "anchor": note.get("anchor") or None,
                    "answer": "",
                    "done": False,
                    "source": note.get("source") or None,
                    "category": note.get("category") or None,
                    "position": i,
                    "created_at": now,
                    "updated_at": now,
                }
            )
    for note_id, story_id, title, content, created, updated in conn.execute(
        sa.text("SELECT id, story_id, title, content, created_at, updated_at FROM story_notes")
    ):
        text = (content or "").strip()
        if not text:
            continue
        heading = (title or "").strip()
        add(
            {
                "id": note_id,
                "story_id": story_id,
                "kind": "idea",
                "content": f"{heading}\n{text}" if heading and heading != "Untitled Note" else text,
                "node_id": None,
                "anchor": None,
                "answer": "",
                "done": False,
                "source": None,
                "category": None,
                "position": 0,
                "created_at": _when(created, now),
                "updated_at": _when(updated, now),
            }
        )
    if rows:
        op.bulk_insert(NOTES, rows)

    # Dropped in place: a batch rebuild of structure_nodes would DROP the table that notes
    # (and much else) point at, which foreign keys refuse.
    op.execute("ALTER TABLE structure_nodes DROP COLUMN inline_notes")
    op.drop_table("story_notes")


def downgrade() -> None:
    conn = op.get_bind()
    op.create_table(
        "story_notes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("structure_nodes", sa.Column("inline_notes", sa.JSON(), nullable=True))

    margin: dict[str, list[dict]] = {}
    for note_id, node_id, content, anchor, source, category, position in conn.execute(
        sa.text(
            "SELECT id, node_id, content, anchor, source, category, position FROM notes "
            "WHERE kind = 'note' AND node_id IS NOT NULL"
        )
    ):
        note = {"id": note_id, "anchor": anchor or "", "note": content, "position": position}
        if source:
            note.update(type="editorial", source=source, category=category)
        margin.setdefault(node_id, []).append(note)
    for node_id, notes in margin.items():
        conn.execute(
            sa.text("UPDATE structure_nodes SET inline_notes = :notes WHERE id = :id"),
            {"notes": json.dumps(notes), "id": node_id},
        )
    conn.execute(
        sa.text(
            "INSERT INTO story_notes (id, story_id, title, content, category, tags, created_at, updated_at) "
            "SELECT id, story_id, 'Untitled Note', content, 'ideas', '[]', created_at, updated_at "
            "FROM notes WHERE kind = 'idea'"
        )
    )
    conn.execute(sa.text("DELETE FROM notes WHERE kind IN ('note', 'idea')"))

    with op.batch_alter_table("notes") as batch_op:
        batch_op.add_column(sa.Column("doc_from", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("doc_to", sa.Integer(), nullable=True))
        batch_op.drop_column("category")
        batch_op.drop_column("source")
        batch_op.drop_column("anchor")
        batch_op.alter_column("kind", existing_type=sa.String(), server_default="todo")
        batch_op.drop_index("ix_notes_story_id")
        batch_op.drop_index("ix_notes_node_id")
        batch_op.create_index("ix_story_todos_story_id", ["story_id"], unique=False)
        batch_op.create_index("ix_story_todos_node_id", ["node_id"], unique=False)
    op.rename_table("notes", "story_todos")
