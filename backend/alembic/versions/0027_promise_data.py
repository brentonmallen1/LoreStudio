"""Promise data made consistent (doc 18, B4)

Data only, no schema change:

- Scene links use the types the editor offers. "mirror" (the demo's bookends) is a parallel;
  anything else unknown is an echo.
- A callback points back to an earlier scene and foreshadowing points ahead; links drawn the
  other way round are turned.
- "Characters who know" holds character ids. Names typed into the reader-knowledge form or
  returned by the scan are matched to a character's name or other names (any case), or to a
  single word of one name only one character has; names that match nobody are dropped.

Revision ID: 0027_promise_data
Revises: 0026_character_aliases
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027_promise_data"
down_revision: str | None = "0026_character_aliases"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LINK_TYPES = {"foreshadowing", "callback", "causes", "parallel", "contrast", "echoes"}


def _reading_order(rows) -> dict[str, int]:
    children: dict = {}
    for node_id, parent_id, position in rows:
        children.setdefault(parent_id, []).append((position or 0, node_id))
    order: dict[str, int] = {}

    def walk(parent) -> None:
        for _pos, node_id in sorted(children.get(parent, [])):
            order[node_id] = len(order)
            walk(node_id)

    walk(None)
    return order


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return []
    return list(value) if isinstance(value, list) else []


def upgrade() -> None:
    bind = op.get_bind()

    for old, new in (("mirror", "parallel"),):
        bind.execute(sa.text("UPDATE scene_links SET link_type = :new WHERE link_type = :old"), {"new": new, "old": old})
    bind.execute(
        sa.text("UPDATE scene_links SET link_type = 'echoes' WHERE link_type NOT IN :types").bindparams(
            sa.bindparam("types", expanding=True)
        ),
        {"types": sorted(LINK_TYPES)},
    )

    orders: dict[str, dict[str, int]] = {}
    links = bind.execute(
        sa.text(
            "SELECT id, story_id, source_node_id, target_node_id, link_type FROM scene_links "
            "WHERE link_type IN ('callback', 'foreshadowing')"
        )
    ).fetchall()
    for link_id, story_id, src, dst, kind in links:
        if story_id not in orders:
            rows = bind.execute(
                sa.text("SELECT id, parent_id, position FROM structure_nodes WHERE story_id = :s"), {"s": story_id}
            ).fetchall()
            orders[story_id] = _reading_order(rows)
        order = orders[story_id]
        a, b = order.get(src, 0), order.get(dst, 0)
        if (kind == "callback" and b > a) or (kind == "foreshadowing" and b < a):
            bind.execute(
                sa.text("UPDATE scene_links SET source_node_id = :dst, target_node_id = :src WHERE id = :id"),
                {"src": src, "dst": dst, "id": link_id},
            )

    chars: dict[str, list[tuple[str, str, list]]] = {}
    for cid, story_id, name, aliases in bind.execute(
        sa.text("SELECT id, story_id, name, aliases FROM characters")
    ).fetchall():
        chars.setdefault(story_id, []).append((cid, name or "", _as_list(aliases)))
    events = bind.execute(sa.text("SELECT id, story_id, characters_who_know FROM reader_knowledge_events")).fetchall()
    for event_id, story_id, who in events:
        values = _as_list(who)
        if not values:
            continue
        cast = chars.get(story_id, [])
        ids = {c[0] for c in cast}
        exact: dict[str, str] = {}
        words: dict[str, set[str]] = {}
        for cid, name, aliases in cast:
            for n in [name, *aliases]:
                if n:
                    exact.setdefault(" ".join(str(n).split()).casefold(), cid)
                    for w in str(n).split():
                        words.setdefault(w.casefold(), set()).add(cid)
        out: list[str] = []
        for raw in values:
            v = " ".join(str(raw).split())
            cid = v if v in ids else exact.get(v.casefold())
            if cid is None and len(words.get(v.casefold(), ())) == 1:
                cid = next(iter(words[v.casefold()]))
            if cid and cid not in out:
                out.append(cid)
        if out != values:
            bind.execute(
                sa.text("UPDATE reader_knowledge_events SET characters_who_know = :w WHERE id = :id"),
                {"w": json.dumps(out), "id": event_id},
            )


def downgrade() -> None:
    # Data only; the old values were the inconsistency.
    pass
