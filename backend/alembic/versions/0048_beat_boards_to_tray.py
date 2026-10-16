"""Beat boards fold into the Outline's Not placed yet tray

Doc 29 D3: a beat board's real job, ideas without a place yet, is the Outline's tray. Each
story keeps one ``outlines`` row, the tray, named "Not placed yet", and its ideas are flat
``outline_items`` in one order:

- Every board's items, board by board and depth first. A nested item keeps its text; the
  line it sat under goes at the head of its notes ("Under “…”"). With more than one board,
  each item's text starts with its board's name. Beat-type dots go (``beat_type`` is cleared).
- An item already made into a scene that still stands has its place: it leaves the tray, and
  its notes, if any, become a note on that scene. One whose scene is gone stays, unlinked.
- The Storyboard's free notes (a ``storyboard`` diagram's nodes, doc 29 D2) join the tray
  after the boards, and the diagram, which held nothing else, goes.

Downgrade leaves the data as it is: the tray reads as a single beat board, and nothing the
writer had is lost by going back.

Revision ID: 0048_beat_boards_to_tray
Revises: 0047_working_style
"""

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0048_beat_boards_to_tray"
down_revision: str | None = "0047_working_style"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRAY_NAME = "Not placed yet"
#: A Storyboard note nobody typed into.
_BLANK_NOTES = {"", "Note"}


def _cut(text: str, limit: int = 80) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def fold(
    boards: list[dict], items: list[dict], live_scenes: set[str], board_notes: list[str]
) -> tuple[list[dict], list[dict]]:
    """The tray's ideas, in order, and the items that already became a standing scene.

    ``boards``: ``{id, name}`` in board order. ``items``: ``{id, outline_id, parent_id,
    position, text, notes, scene_id}``. ``board_notes``: the Storyboard's note labels. Each idea
    is ``{id, text, notes}`` (``id`` None for a Storyboard note); each placed one is
    ``{id, scene_id, notes}``.
    """
    by_id = {i["id"]: i for i in items}
    kids: dict[str | None, list[dict]] = {}
    for item in items:
        parent = item["parent_id"] if item["parent_id"] in by_id else None
        kids.setdefault(f"{item['outline_id']}:{parent}", []).append(item)
    named = len([b for b in boards if kids.get(f"{b['id']}:None")]) > 1
    ideas: list[dict] = []
    placed: list[dict] = []

    def walk(board: dict, parent: dict | None) -> None:
        for item in sorted(kids.get(f"{board['id']}:{parent['id'] if parent else None}", []), key=_order):
            text = (item["text"] or "").strip()
            notes = (item["notes"] or "").strip()
            if item["scene_id"] and item["scene_id"] in live_scenes:
                placed.append({"id": item["id"], "scene_id": item["scene_id"], "notes": notes})
            elif text or notes:
                head = [f"Under “{_cut(parent['text'])}”"] if parent and (parent["text"] or "").strip() else []
                prefix = f"{board['name'].strip()}: " if named and board["name"].strip() else ""
                ideas.append(
                    {"id": item["id"], "text": prefix + (text or _cut(notes, 60)), "notes": "\n\n".join(head + ([notes] if notes else []))}
                )
            walk(board, item)

    for board in boards:
        walk(board, None)
    for label in board_notes:
        label = label.strip()
        if label not in _BLANK_NOTES:
            ideas.append({"id": None, "text": label, "notes": "From the Storyboard"})
    return ideas, placed


def _order(item: dict) -> tuple:
    return (item["position"] or 0, item["id"])


def _labels(raw: object) -> list[str]:
    try:
        nodes = json.loads(raw) if isinstance(raw, str) else (raw or [])
    except ValueError:
        return []
    out = []
    for node in nodes if isinstance(nodes, list) else []:
        data = node.get("data") if isinstance(node, dict) else None
        label = data.get("label") if isinstance(data, dict) else None
        if isinstance(label, str):
            out.append(label)
    return out


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(UTC).replace(tzinfo=None)
    stories = {row[0] for row in conn.execute(sa.text("SELECT DISTINCT story_id FROM outlines"))}
    storyboards: dict[str, list[tuple[str, object]]] = {}
    for diagram_id, story_id, nodes in conn.execute(
        sa.text("SELECT id, story_id, nodes FROM diagrams WHERE diagram_type = 'storyboard' ORDER BY created_at")
    ):
        storyboards.setdefault(story_id, []).append((diagram_id, nodes))
    stories |= set(storyboards)

    for story_id in sorted(stories):
        boards = [
            {"id": r[0], "name": r[1] or ""}
            for r in conn.execute(
                sa.text("SELECT id, name FROM outlines WHERE story_id = :s ORDER BY position, created_at, id"),
                {"s": story_id},
            )
        ]
        items = [
            dict(r._mapping)
            for r in conn.execute(
                sa.text(
                    "SELECT i.id, i.outline_id, i.parent_id, i.position, i.text, i.notes, i.scene_id "
                    "FROM outline_items i JOIN outlines o ON o.id = i.outline_id WHERE o.story_id = :s"
                ),
                {"s": story_id},
            )
        ]
        live = {r[0] for r in conn.execute(sa.text("SELECT id FROM structure_nodes WHERE story_id = :s"), {"s": story_id})}
        notes = [label for _, raw in storyboards.get(story_id, []) for label in _labels(raw)]
        ideas, placed = fold(boards, items, live, notes)

        if boards:
            tray_id = boards[0]["id"]
        else:
            tray_id = str(uuid.uuid4())
            conn.execute(
                sa.text(
                    "INSERT INTO outlines (id, story_id, name, position, created_at, updated_at) "
                    "VALUES (:id, :s, :n, 0, :t, :t)"
                ),
                {"id": tray_id, "s": story_id, "n": TRAY_NAME, "t": now},
            )
        conn.execute(
            sa.text("UPDATE outlines SET name = :n, position = 0, source_beat_sheet_id = NULL WHERE id = :id"),
            {"n": TRAY_NAME, "id": tray_id},
        )
        # Flat first, so nothing still points at a row about to go.
        conn.execute(
            sa.text(
                "UPDATE outline_items SET parent_id = NULL WHERE outline_id IN (SELECT id FROM outlines WHERE story_id = :s)"
            ),
            {"s": story_id},
        )
        for at, idea in enumerate(ideas):
            values = {"id": idea["id"], "o": tray_id, "p": at, "t": idea["text"], "n": idea["notes"], "now": now}
            if idea["id"]:
                conn.execute(
                    sa.text(
                        "UPDATE outline_items SET outline_id = :o, level = 0, position = :p, text = :t, notes = :n, "
                        "beat_type = NULL, collapsed = 0, scene_id = NULL, scene_title = NULL WHERE id = :id"
                    ),
                    values,
                )
            else:
                values["id"] = str(uuid.uuid4())
                conn.execute(
                    sa.text(
                        "INSERT INTO outline_items (id, outline_id, parent_id, level, position, text, beat_type, notes, "
                        "collapsed, scene_id, scene_title, created_at, updated_at) "
                        "VALUES (:id, :o, NULL, 0, :p, :t, NULL, :n, 0, NULL, NULL, :now, :now)"
                    ),
                    values,
                )
        for item in placed:
            if item["notes"]:
                conn.execute(
                    sa.text(
                        "INSERT INTO notes (id, story_id, kind, content, node_id, answer, done, position, "
                        "created_at, updated_at) VALUES (:id, :s, 'note', :c, :node, '', 0, 0, :t, :t)"
                    ),
                    {"id": str(uuid.uuid4()), "s": story_id, "c": item["notes"], "node": item["scene_id"], "t": now},
                )
            conn.execute(sa.text("DELETE FROM outline_items WHERE id = :id"), {"id": item["id"]})
        # Whatever is left outside the tray was empty (no text, no notes): it goes with its board.
        conn.execute(
            sa.text(
                "DELETE FROM outline_items WHERE outline_id IN "
                "(SELECT id FROM outlines WHERE story_id = :s AND id != :tray)"
            ),
            {"s": story_id, "tray": tray_id},
        )
        conn.execute(sa.text("DELETE FROM outlines WHERE story_id = :s AND id != :tray"), {"s": story_id, "tray": tray_id})
        conn.execute(
            sa.text("DELETE FROM outline_items WHERE outline_id = :tray AND (trim(text) = '' AND trim(notes) = '')"),
            {"tray": tray_id},
        )
        for diagram_id, _ in storyboards.get(story_id, []):
            conn.execute(sa.text("DELETE FROM diagrams WHERE id = :id"), {"id": diagram_id})


def downgrade() -> None:
    # The tray is a single board of flat items, which the older code reads as it is.
    pass
