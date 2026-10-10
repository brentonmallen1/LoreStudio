"""
A script scene's heading (doc 25, D3) and splitting a scene where a new one starts.

A screenplay scene opens on its heading, "INT. KEEPER'S COTTAGE - NIGHT". The heading is the
first line of the scene's text, typed like any other line (D6); each save reads it into the
scene's own fields, the way dialogue rows are read from the prose: `interior` (INT, EXT…),
`time_of_day`, and the place, linked to the Lorebook when it names a place there. Timeline,
the scene glance and the export read those.

A heading typed further down starts another scene. The editor offers to split there, and
`split_scene` does it in one undoable step: the words after the cut become the next scene,
and the spoken lines and margin notes in them go with them.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.location import Location, SceneSetting
from ..models.note import Note
from ..models.story import Story
from ..models.structure import StructureNode
from . import change_log
from .dialogue_service import plan_scene
from .prose_html import paragraphs
from .prose_syntax import fold, reader_text
from .script_syntax import Slug, parse_slugline, scene_blocks
from .story_format import is_script
from .word_count import count_lines, count_words

_NOTE_ID = re.compile(r"""data-note-id=["']([^"']+)["']""")


def heading_of(html: str | None) -> Slug | None:
    """The scene's heading, read, when its first line is one."""
    blocks = scene_blocks(html or "")
    if blocks and blocks[0][0] == "heading":
        return parse_slugline(blocks[0][1])
    return None


def cut_at_heading(html: str, heading: str) -> tuple[str, str] | None:
    """The scene's HTML cut just before the block holding `heading`, when that is a heading
    further down than the first line: (the words before it, it and the words after)."""
    for para in paragraphs(html)[1:]:
        if para.element == "heading" and reader_text(para.text) == heading:
            at = html.rfind("<", 0, para.spans[0][0])
            while at > 0 and not re.match(r"<p[\s>]", html[at:]):
                at = html.rfind("<", 0, at)
            return (html[:at], html[at:]) if at > 0 else None
    return None


def _key(name: str) -> str:
    return re.sub(r"^the\s+", "", fold(name))


def match_place(place: str, locations: list[Location]) -> Location | None:
    """The Lorebook place a heading names: the whole place ("KEEPER'S COTTAGE"), or else its
    last part, most particular first ("LIGHTHOUSE, LAMP ROOM" is the Lamp Room)."""
    if not place.strip():
        return None
    by_name: dict[str, Location] = {}
    for loc in locations:
        for name in [loc.name, *(loc.aliases or [])]:
            by_name.setdefault(_key(name), loc)
    parts = [p for p in re.split(r"\s*(?:,| - )\s*", place) if p.strip()]
    for candidate in [place, *reversed(parts)]:
        if found := by_name.get(_key(candidate)):
            return found
    return None


def derive_heading(node: StructureNode, story: Story | None, db: Session) -> None:
    """Read a script scene's heading into its fields, and link its place when the Lorebook has
    it and the scene has no place yet. The author's own choice of place is never replaced."""
    if not is_script(story):
        return
    slug = heading_of(node.content) or Slug()
    node.interior = slug.interior
    node.time_of_day = slug.time
    if not slug.place:
        return
    locations = db.query(Location).filter(Location.story_id == node.story_id).all()
    place = match_place(slug.place, locations)
    has_primary = db.query(SceneSetting).filter(SceneSetting.node_id == node.id, SceneSetting.role == "primary").first()
    if place and not has_primary:
        db.add(SceneSetting(location_id=place.id, node_id=node.id, role="primary", notes="From the scene heading."))


def _title(slug: Slug | None) -> str:
    if not slug or not slug.place:
        return "New scene"
    words = slug.place.lower().split()
    return " ".join(w[:1].upper() + w[1:] for w in words)


def split_scene(
    db: Session,
    node: StructureNode,
    before: str,
    after: str,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> StructureNode:
    """Keep `before` in the scene and make `after` (which opens on its heading) the scene that
    follows it, as one change ⌘Z takes back whole. Does not commit."""
    story = db.get(Story, node.story_id)
    batch = str(uuid.uuid4())
    slug = heading_of(after)
    record = {"story_id": node.story_id, "actor_id": actor_id, "client_id": client_id, "batch_id": batch}
    label = f"Start a new scene after “{node.title or 'Untitled'}”"

    # The scenes after this one move down to make room.
    later = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id == node.story_id,
            StructureNode.parent_id == node.parent_id,
            StructureNode.position > node.position,
        )
        .all()
    )
    for sibling in later:
        change_log.record_update(
            db, sibling, {"position": sibling.position + 1}, entity_type="structure_node", label=label, **record
        )
        sibling.position += 1

    new = StructureNode(
        story_id=node.story_id,
        parent_id=node.parent_id,
        level=node.level,
        level_type=node.level_type,
        title=_title(slug),
        position=node.position + 1,
        status="draft",
        content=after,
        word_count=count_words(after),
        line_count=count_lines(story, after),
    )
    db.add(new)
    db.flush()
    change_log.record_row_create(db, new, "structure_nodes", entity_type="structure_node", label=label, **record)

    old_rows = db.query(DialogueBlock).filter(DialogueBlock.scene_id == node.id).all()
    change_log.rewrite_prose(db, node, before, label=label, batch_id=batch, actor_id=actor_id, client_id=client_id)
    node.word_count = count_words(before)
    node.line_count = count_lines(story, before)

    # A spoken line now in the new scene takes its row along: its speaker as corrected, its
    # subtext. Rows are matched by their words, as the dialogue reader matches them.
    characters = db.query(Character).filter(Character.story_id == node.story_id).all()
    staying = [line["content"] for line in plan_scene(node, story, characters)]
    for line in plan_scene(new, story, characters):
        row = next((r for r in old_rows if r.content == line["content"] and r.content not in staying), None)
        if row is None:
            continue
        old_rows.remove(row)
        moved = {"scene_id": new.id, "paragraph_index": line["paragraph_index"]}
        change_log.record_update(db, row, moved, entity_type="dialogue_block", label=label, **record)
        for key, value in moved.items():
            setattr(row, key, value)

    # Margin notes on words that moved go with them.
    moved_notes = set(_NOTE_ID.findall(after))
    if moved_notes:
        for note in db.query(Note).filter(Note.node_id == node.id, Note.id.in_(moved_notes)).all():
            change_log.record_update(db, note, {"node_id": new.id}, entity_type="note", label=label, **record)
            note.node_id = new.id

    derive_heading(node, story, db)
    derive_heading(new, story, db)
    return new
