"""
Organizing what is written (doc 29 D6): join a scene with the next one, and wrap scenes in a
chapter. Splitting a scene is `script_scene.split_scene`, which prose and scripts share.

Each is one change ⌘Z takes back whole: every row that moves is recorded in the same batch,
before the node that goes is recorded as deleted, so undo puts the node back first and then
returns every row to it.

**Joining** keeps the first scene and puts the second's words after its own, with a scene break
(`<hr>`, the editor's own break, which the importer also reads as one) between them: the seam
stays where it was, so the join reads as the two scenes did, and it is one Backspace to take
away. Lines of what happens and key events join; the first scene's start and the second's end
are the joined scene's. Everything that pointed at the second scene (notes, dialogue rows,
links, threads, places, who is here, tropes, twists, clues, what the reader learns) points at
the first. Scenes join only within one part: the next scene in another chapter is refused.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.location import ScenePresence, SceneSetting
from ..models.note import Note
from ..models.plot_thread import PlotThreadAppearance
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.scene_link import SceneLink
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.trope import TropeLink
from ..models.twist import Twist, TwistClue
from . import change_log
from .held_prose import template_levels
from .prose_html import paragraphs
from .structure_scaffold import FLAT
from .word_count import count_lines, count_words

#: What goes between two joined scenes' words: the editor's scene break.
SCENE_BREAK = "<hr>"


class OrganizeError(Exception):
    """Why it cannot be done, in words for the writer."""


def _siblings(db: Session, node: StructureNode) -> list[StructureNode]:
    q = db.query(StructureNode).filter(StructureNode.story_id == node.story_id)
    q = q.filter(
        StructureNode.parent_id.is_(None) if node.parent_id is None else StructureNode.parent_id == node.parent_id
    )
    return sorted(q.all(), key=lambda n: (n.position, n.created_at))


def _holds_parts(db: Session, node: StructureNode) -> bool:
    return db.query(StructureNode.id).filter(StructureNode.parent_id == node.id).first() is not None


def _join(*parts: str | None, sep: str = " ") -> str:
    return sep.join(p.strip() for p in parts if p and p.strip())


def _title(node: StructureNode | None) -> str:
    return (node.title or "Untitled") if node else "Untitled"


def next_scene(db: Session, node: StructureNode) -> StructureNode | None:
    """The scene after this one in the same part, or None at the part's end."""
    sibs = _siblings(db, node)
    at = next((i for i, n in enumerate(sibs) if n.id == node.id), -1)
    return sibs[at + 1] if 0 <= at < len(sibs) - 1 else None


class _Change:
    """One change ⌘Z takes back whole: every row it moves, makes or drops, in one batch."""

    def __init__(self, db: Session, story_id: str, label: str, actor_id: str | None, client_id: str | None):
        self.db, self.story_id, self.label = db, story_id, label
        self.actor_id, self.client_id = actor_id, client_id
        self.batch = str(uuid.uuid4())

    def _common(self) -> dict:
        return {"story_id": self.story_id, "label": self.label, "actor_id": self.actor_id, "client_id": self.client_id}

    def move(self, obj, entity_type: str, data: dict) -> None:
        after = change_log.record_update(
            self.db, obj, data, entity_type=entity_type, batch_id=self.batch, **self._common()
        )
        for key, value in (after or {}).items():
            setattr(obj, key, value)

    def drop(self, obj, table: str, entity_type: str) -> None:
        change_log.record_row_delete(
            self.db, obj, table, entity_type=entity_type, batch_id=self.batch, **self._common()
        )
        self.db.delete(obj)

    def made(self, obj, table: str, entity_type: str) -> None:
        self.db.add(obj)
        self.db.flush()
        change_log.record_row_create(
            self.db, obj, table, entity_type=entity_type, batch_id=self.batch, **self._common()
        )

    def gone(self, node: StructureNode) -> None:
        """A node deleted with whatever is still on it, recorded so undo brings it all back."""
        self.db.flush()
        self.db.refresh(node)
        change_log.record(
            self.db,
            entity_type="structure_node",
            entity_id=node.id,
            action="delete",
            before=change_log.capture_node_tree(node, self.db),
            after=None,
            batch_id=self.batch,
            **self._common(),
        )
        self.db.delete(node)
        self.db.flush()


def _retarget(change: _Change, db: Session, node: StructureNode, nxt: StructureNode) -> None:
    """Everything that pointed at the next scene points at this one. A row this scene already
    has (the same thread, place, trope) stays on the next scene and goes, and comes back, with it."""
    move = change.move
    offset = len(paragraphs(node.content or ""))
    for note in db.query(Note).filter(Note.node_id == nxt.id).all():
        move(note, "note", {"node_id": node.id})
    for row in db.query(DialogueBlock).filter(DialogueBlock.scene_id == nxt.id).all():
        move(row, "dialogue_block", {"scene_id": node.id, "paragraph_index": (row.paragraph_index or 0) + offset})
    for link in db.query(SceneLink).filter((SceneLink.source_node_id == nxt.id) | (SceneLink.target_node_id == nxt.id)):
        if node.id in (link.source_node_id, link.target_node_id):  # a link between the two would be to itself
            change.drop(link, "scene_links", "scene_link")
            continue
        ends = {"source_node_id": link.source_node_id, "target_node_id": link.target_node_id}
        move(link, "scene_link", {k: node.id if v == nxt.id else v for k, v in ends.items()})
    for model, column, key, entity_type in _ONE_EACH:
        have = {getattr(r, key) for r in db.query(model).filter(getattr(model, column) == node.id)}
        for row in db.query(model).filter(getattr(model, column) == nxt.id).all():
            if getattr(row, key) not in have:
                move(row, entity_type, {column: node.id})
            elif model is ScenePresence:  # not in a deleted scene's bundle: dropped on its own
                change.drop(row, "scene_presence", "scene_presence")
    for model, column, entity_type in _POINTERS:
        for row in db.query(model).filter(getattr(model, column) == nxt.id).all():
            move(row, entity_type, {column: node.id})
    for c in db.query(Character).filter(Character.story_id == node.story_id).all():
        data = {}
        for column in ("facets", "formative"):
            entries = getattr(c, column) or []
            if any(e.get("revealed_in") == nxt.id for e in entries):
                data[column] = [{**e, "revealed_in": node.id} if e.get("revealed_in") == nxt.id else e for e in entries]
        if data:
            move(c, "character", data)


#: Rows a scene has one of per thread, place, person or trope: (model, scene column, key, type).
_ONE_EACH = (
    (PlotThreadAppearance, "node_id", "thread_id", "plot_thread_appearance"),
    (SceneSetting, "node_id", "location_id", "scene_setting"),
    (ScenePresence, "node_id", "character_id", "scene_presence"),
    (TropeLink, "node_id", "trope_id", "trope_link"),
)
#: Rows that name a scene: (model, column, type).
_POINTERS = (
    (Twist, "revealed_at_node_id", "twist"),
    (TwistClue, "node_id", "twist_clue"),
    (ReaderKnowledgeEvent, "node_id", "reader_knowledge_event"),
)


def _refuse_join(db: Session, node: StructureNode, nxt: StructureNode | None) -> None:
    if _holds_parts(db, node):
        raise OrganizeError(f"“{_title(node)}” holds other parts; only scenes join.")
    if nxt is None:
        parent = db.get(StructureNode, node.parent_id) if node.parent_id else None
        where = f"the last scene in “{_title(parent)}”" if parent else "the last scene in the story"
        part = (parent.level_type or "part").lower() if parent else "part"
        raise OrganizeError(
            f"“{_title(node)}” is {where}. Scenes join only within one {part}: move one of them first, then join."
        )
    if _holds_parts(db, nxt):
        raise OrganizeError(f"“{_title(nxt)}” holds other parts; only scenes join.")


def merge_next(db: Session, node: StructureNode, *, actor_id: str | None, client_id: str | None) -> StructureNode:
    """Join the scene with the next one in its part, as one change. Does not commit."""
    nxt = next_scene(db, node)
    _refuse_join(db, node, nxt)
    assert nxt is not None
    story = db.get(Story, node.story_id)
    change = _Change(db, node.story_id, f"Join “{_title(node)}” and “{_title(nxt)}”", actor_id, client_id)
    _retarget(change, db, node, nxt)

    # The words, joined at a scene break, and the scene's lines with them.
    content = _join(node.content, nxt.content, sep=SCENE_BREAK)
    change_log.rewrite_prose(
        db, node, content, label=change.label, batch_id=change.batch, actor_id=actor_id, client_id=client_id
    )
    words = count_words(content)
    change.move(
        node,
        "structure_node",
        {
            "synopsis": _join(node.synopsis, nxt.synopsis),
            "key_events": _join(node.key_events, nxt.key_events, sep="; "),
            "purpose": _join(node.purpose, nxt.purpose),
            "entry_state": node.entry_state or nxt.entry_state,
            "exit_state": nxt.exit_state or node.exit_state,
            "pov_character_id": node.pov_character_id or nxt.pov_character_id,
            "beat_id": node.beat_id or nxt.beat_id,
            "word_count": words,
            "line_count": count_lines(story, content),
            "status": "draft" if node.status == "planned" and words else node.status,
            "summary_stale": True,
        },
    )
    change.gone(nxt)
    return node


def _chosen(db: Session, story: Story, node_ids: list[str]) -> tuple[list, list, list, StructureNode | None]:
    """The scenes to wrap, with the scenes before and after them in their part, and the part."""
    scenes = [db.get(StructureNode, i) for i in dict.fromkeys(node_ids)]
    if not scenes or any(s is None or s.story_id != story.id for s in scenes):
        raise OrganizeError("Those scenes aren't in this story.")
    chosen: list[StructureNode] = [s for s in scenes if s is not None]
    if any(_holds_parts(db, s) for s in chosen):
        raise OrganizeError("Only scenes can be wrapped; one of those holds other parts.")
    if len({s.parent_id for s in chosen}) > 1:
        raise OrganizeError("Choose scenes from one part: they are wrapped where they stand.")
    sibs = _siblings(db, chosen[0])
    at = sorted(sibs.index(s) for s in chosen)
    if at != list(range(at[0], at[-1] + 1)):
        raise OrganizeError("Choose scenes that sit next to each other, so the order stays as it is.")
    holder = db.get(StructureNode, chosen[0].parent_id) if chosen[0].parent_id else None
    before, after = sibs[: at[0]], sibs[at[-1] + 1 :]
    if holder is not None and not before and not after:
        raise OrganizeError(f"Those are every scene in “{_title(holder)}” already.")
    return before, sibs[at[0] : at[-1] + 1], after, holder


def wrap_scenes(
    db: Session,
    story: Story,
    node_ids: list[str],
    title: str,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> list[StructureNode]:
    """
    Put scenes that sit next to each other in a part of their own, the level above scenes in the
    story's shape (a chapter), in their place. Scenes from the middle of a chapter leave it in
    three: the scenes before stay, the new chapter holds the chosen ones, and the scenes after go
    into "<chapter> (continued)" after it, so the reading order never changes. Returns the parts
    made. One change; does not commit.
    """
    levels = template_levels(story, db)
    if story.structure_template_id in FLAT or len(levels) < 2:
        raise OrganizeError(
            "This story's shape keeps its scenes side by side, with no level above them to wrap them in."
        )
    before, picked, after, holder = _chosen(db, story, node_ids)
    depth = max(0, holder.level if holder else picked[0].level - 1)
    level_type = (levels[min(depth, len(levels) - 1)].get("name") or "part").lower()
    noun = "scene" if len(picked) == 1 else "scenes"
    change = _Change(db, story.id, f"Wrap {len(picked)} {noun} in a {level_type}", actor_id, client_id)

    def make(name: str, parent_id: str | None, position: int) -> StructureNode:
        part = StructureNode(
            story_id=story.id, parent_id=parent_id, level=depth, level_type=level_type, title=name,
            position=position, status="draft",
        )  # fmt: skip
        change.made(part, "structure_nodes", "structure_node")
        return part

    if holder is None:
        # Scenes at the top of the book: the part takes the first one's place among them.
        made = [make(title, None, picked[0].position)]
    else:
        # The parts in their new order, the new ones made where they will stand.
        parts = _siblings(db, holder)
        k = parts.index(holder)
        middle: list[StructureNode | str] = (
            [holder, "part", *(["rest"] if after else [])] if before else ["part", holder]
        )
        order = [*parts[:k], *middle, *parts[k + 1 :]]
        made = [make(title, holder.parent_id, order.index("part"))]
        if "rest" in order:
            made.append(make(f"{_title(holder)} (continued)", holder.parent_id, order.index("rest")))
            for i, s in enumerate(after):
                change.move(s, "structure_node", {"parent_id": made[1].id, "position": i})
        for i, p in enumerate(order):
            if isinstance(p, StructureNode):
                change.move(p, "structure_node", {"position": i})
    for i, s in enumerate(picked):
        change.move(s, "structure_node", {"parent_id": made[0].id, "position": i})
    db.flush()
    return made
