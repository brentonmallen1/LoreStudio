"""
Resolving and rendering @-mentions (doc 11 P6).

The assembler decides what a feature is told on its own (`context.py`). This adds what
the author pointed at: each ref becomes a short dict the packet carries under
`mentioned`, and one section every prompt builder appends. Unknown ids, ids from another
story and duplicates are dropped rather than refused: a stale chip should not fail a send.
"""

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.location import Location
from ...models.plot_thread import PlotThread
from ...models.structure import StructureNode
from ...schemas.mentions import MentionedRef
from ..worldbuilding_context import _location_to_dict

MENTION_PROSE_LIMIT = 600

SECTION_HEADING = "## Also in mind (the author @mentioned these)"

_LABELS = {
    "role": "Role",
    "personality": "Personality",
    "motivation": "Motivation",
    "arc_notes": "Arc",
    "narrative_intent": "Author's plan",
    "type": "Type",
    "description": "Description",
    "atmosphere": "Atmosphere",
    "significance": "Significance",
    "history": "History",
    "synopsis": "Synopsis",
    "purpose": "Purpose",
    "status": "Status",
    "resolution": "Resolution",
    "prose_preview": "Opens",
}


def _character(c: Character) -> dict:
    item: dict = {"kind": "character", "id": c.id, "name": c.name, "role": c.role}
    for key in ("personality", "motivation", "arc_notes"):
        if getattr(c, key):
            item[key] = getattr(c, key)
    if c.narrative_intent and not c.narrative_intent_hidden:
        item["narrative_intent"] = c.narrative_intent
    return item


def _location(loc: Location) -> dict:
    item = _location_to_dict(loc)
    item.pop("celestial", None)
    return {"kind": "location", "id": loc.id, **item}


def _scene(node: StructureNode) -> dict:
    item: dict = {"kind": "scene", "id": node.id, "name": node.title, "level_type": node.level_type}
    for key in ("synopsis", "purpose"):
        if getattr(node, key):
            item[key] = getattr(node, key)
    if node.content:
        item["prose_preview"] = node.content[:MENTION_PROSE_LIMIT] + (
            "…" if len(node.content) > MENTION_PROSE_LIMIT else ""
        )
    return item


def _thread(t: PlotThread) -> dict:
    item: dict = {"kind": "thread", "id": t.id, "name": t.name, "status": t.status}
    for key in ("description", "resolution"):
        if getattr(t, key, None):
            item[key] = getattr(t, key)
    return item


def _resolve_one(story_id: str, ref: MentionedRef, db: Session) -> dict | None:
    if ref.kind == "character":
        c = db.get(Character, ref.id)
        return _character(c) if c and c.story_id == story_id else None
    if ref.kind == "location":
        loc = db.get(Location, ref.id)
        return _location(loc) if loc and loc.story_id == story_id else None
    if ref.kind == "scene":
        node = db.get(StructureNode, ref.id)
        return _scene(node) if node and node.story_id == story_id else None
    t = db.get(PlotThread, ref.id)
    return _thread(t) if t and t.story_id == story_id else None


def resolve_mentions(story_id: str, refs: list[MentionedRef] | None, db: Session) -> list[dict]:
    """The refs that exist in this story, in the order the author mentioned them, once each."""
    items: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for ref in refs or []:
        if (ref.kind, ref.id) in seen:
            continue
        seen.add((ref.kind, ref.id))
        item = _resolve_one(story_id, ref, db)
        if item is not None:
            items.append(item)
    return items


def without(
    items: list[dict], *, names_by_kind: dict[str, set[str]] | None = None, node_id: str | None = None
) -> list[dict]:
    """
    The mentions the automatic selection did not already cover.

    A character the prose @mentions is in the packet under `characters_in_scene`; naming
    them again would tell the model the same thing twice and show the author a mention
    that did nothing. The scene being written is never a mention of itself either.
    """
    names_by_kind = names_by_kind or {}
    kept = []
    for item in items:
        if item["kind"] == "scene" and item["id"] == node_id:
            continue
        if item["name"].lower() in {n.lower() for n in names_by_kind.get(item["kind"], set())}:
            continue
        kept.append(item)
    return kept


def render_mentions(items: list[dict] | None) -> str:
    """The prompt section, or "" when nothing was mentioned. Starts on a new line."""
    if not items:
        return ""
    lines = ["", SECTION_HEADING]
    for item in items:
        lines.append(f"\n### {item['name']} ({item['kind']})")
        for key, label in _LABELS.items():
            value = item.get(key)
            if value:
                lines.append(f"{label}: {value}")
    return "\n" + "\n".join(lines)
