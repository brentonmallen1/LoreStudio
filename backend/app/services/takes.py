"""
Scene takes (doc 29 D7): whole-scene versions of one scene's prose, one of which counts.

**The model.** The take that counts is the scene's prose everywhere, so its text is
``StructureNode.content`` and nothing that reads prose (exports, counts, checks, the Codex,
search, the strip) needs to know about takes. The others are ``SceneTake`` rows. A scene with
one take has no rows; "Try another version" makes two, the first standing for the prose that
counts (``counts``, its own ``content`` empty, its word count the scene's). Choosing another take
to count swaps the texts: the chosen take's words become the scene's, and the scene's words go
into the row of the take that counted. A take keeps its number and name through a swap, because
both follow the row.

**What is open.** One row is ``is_open``: the take the editor shows and autosave writes to. When
that is the take that counts, the editor writes the scene's prose as it always has; otherwise it
writes the row (``write``).

**Undo.** Making, switching, choosing, renaming and deleting are each one change ⌘Z takes back
whole. Typing in a take is logged, not undoable here: it is the editor's own history, as typing
in the scene is. A save to a take sends the stamp the editor loaded, and a take changed since
answers 409 (Keep mine or Take theirs), as the scene's prose does.

**Rewrites across the story.** A replace, new quotes and a rename reach every take, not just
the one that counts (``others``): each take is written through ``change_log.rewrite_prose`` in
the same batch as the prose, so choosing a take later does not bring back what was replaced, and
one ⌘Z takes the whole rewrite back. A rewrite of one scene's words where they stand (a
finding's fix, tagged speakers, linked names, new pronouns) is about the prose that counts, the
text it was read from, and leaves the other takes alone.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from sqlalchemy.orm import Session

from ..models.scene_take import SceneTake
from ..models.story import Story
from ..models.structure import StructureNode
from . import change_log
from .word_count import count_lines


class TakeError(Exception):
    """Why it cannot be done, in words for the writer."""


#: The first take's name when "Try another version" makes the second.
FIRST_LABEL = "first draft"


def takes_of(db: Session, node: StructureNode) -> list[SceneTake]:
    """The scene's takes in order; empty while it has only the one."""
    return db.query(SceneTake).filter(SceneTake.node_id == node.id).order_by(SceneTake.position).all()


def others(db: Session, story_id: str, node_ids: Iterable[str] | None = None) -> list[SceneTake]:
    """The takes that do not count in a story (or in these of its scenes), for a rewrite across
    the story to reach as well as the prose."""
    q = (
        db.query(SceneTake)
        .join(StructureNode, SceneTake.node_id == StructureNode.id)
        .filter(StructureNode.story_id == story_id, SceneTake.counts.is_(False))
    )
    if node_ids is not None:
        q = q.filter(SceneTake.node_id.in_(list(node_ids)))
    return q.order_by(SceneTake.node_id, SceneTake.position).all()


def name_of(takes: list[SceneTake], take: SceneTake) -> str:
    """ "Take 2" or "Take 2 · Calder speaks first": numbered by place among the scene's takes."""
    number = next((i + 1 for i, t in enumerate(takes) if t.id == take.id), 0)
    return f"Take {number}" + (f" · {take.label}" if take.label else "")


def text_of(node: StructureNode, take: SceneTake) -> tuple[str, int]:
    """A take's prose and words: the scene's own for the take that counts."""
    return (node.content or "", node.word_count or 0) if take.counts else (take.content or "", take.word_count or 0)


def refuse_cut(db: Session, node: StructureNode | None) -> None:
    """Splitting or joining works on one text: a scene with takes says so instead."""
    if node is None:
        return
    n = db.query(SceneTake).filter(SceneTake.node_id == node.id).count()
    if n:
        raise TakeError(
            f"“{node.title or 'Untitled'}” has {n} takes. Keep the one that counts and delete the others, "
            "then split or join it."
        )


class _Change:
    """One change ⌘Z takes back whole."""

    def __init__(self, db: Session, node: StructureNode, label: str, actor_id: str | None, client_id: str | None):
        self.db, self.story_id, self.label = db, node.story_id, label
        self.actor_id, self.client_id = actor_id, client_id
        self.batch = str(uuid.uuid4())

    def update(self, obj, entity_type: str, data: dict) -> None:
        after = change_log.record_update(
            self.db, obj, data, entity_type=entity_type, story_id=self.story_id, label=self.label,
            actor_id=self.actor_id, client_id=self.client_id, batch_id=self.batch,
        )  # fmt: skip
        for key, value in (after or {}).items():
            setattr(obj, key, value)

    def make(self, take: SceneTake) -> None:
        self.db.add(take)
        self.db.flush()
        change_log.record_row_create(
            self.db, take, "scene_takes", entity_type="scene_take", story_id=self.story_id, label=self.label,
            actor_id=self.actor_id, client_id=self.client_id, batch_id=self.batch,
        )  # fmt: skip

    def drop(self, take: SceneTake) -> None:
        change_log.record_row_delete(
            self.db, take, "scene_takes", entity_type="scene_take", story_id=self.story_id, label=self.label,
            actor_id=self.actor_id, client_id=self.client_id, batch_id=self.batch,
        )  # fmt: skip
        self.db.delete(take)
        self.db.flush()


def _title(node: StructureNode) -> str:
    return node.title or "Untitled"


def try_another(db: Session, node: StructureNode, *, actor_id: str | None, client_id: str | None) -> SceneTake:
    """A new take, a copy of the open one (the scene's prose, the first time), opened. Does not
    commit."""
    takes = takes_of(db, node)
    change = _Change(db, node, f"Try another version of “{_title(node)}”", actor_id, client_id)
    if not takes:
        # The prose so far is take 1, the one that counts; the copy is take 2.
        first = SceneTake(node_id=node.id, label=FIRST_LABEL, position=0, counts=True, word_count=node.word_count or 0)
        change.make(first)
        content, words = node.content or "", node.word_count or 0
        takes = [first]
    else:
        source = next((t for t in takes if t.is_open), takes[0])
        content, words = text_of(node, source)
        for t in takes:
            if t.is_open:
                change.update(t, "scene_take", {"is_open": False})
    new = SceneTake(
        node_id=node.id,
        content=content,
        word_count=words,
        position=max(t.position for t in takes) + 1,
        is_open=True,
    )
    change.make(new)
    return new


def open_take(db: Session, node: StructureNode, take: SceneTake, *, actor_id, client_id) -> None:
    """Show this take in the editor. Does not commit."""
    if take.is_open:
        return
    takes = takes_of(db, node)
    change = _Change(db, node, f"Switch to {name_of(takes, take)} of “{_title(node)}”", actor_id, client_id)
    for t in takes:
        if t.is_open:
            change.update(t, "scene_take", {"is_open": False})
    change.update(take, "scene_take", {"is_open": True})


def use_take(db: Session, node: StructureNode, take: SceneTake, *, actor_id, client_id) -> None:
    """Make this take the one that counts: its words become the scene's prose, and the scene's
    words go to the take that counted. Does not commit."""
    if take.counts:
        return
    takes = takes_of(db, node)
    counting = next((t for t in takes if t.counts), None)
    if counting is None:
        raise TakeError("This scene has no take that counts; open it again.")
    change = _Change(db, node, f"Use {name_of(takes, take)} of “{_title(node)}”", actor_id, client_id)
    was, was_words = node.content or "", node.word_count or 0
    content, words = take.content or "", take.word_count or 0
    story = db.get(Story, node.story_id)
    change_log.rewrite_prose(
        db, node, content, label=change.label, batch_id=change.batch, actor_id=actor_id, client_id=client_id
    )
    node_fields = {"word_count": words, "line_count": count_lines(story, content), "summary_stale": True}
    if node.status == "planned" and words:
        node_fields["status"] = "draft"
    change.update(node, "structure_node", node_fields)
    change.update(counting, "scene_take", {"counts": False, "content": was, "word_count": was_words})
    change.update(take, "scene_take", {"counts": True, "content": "", "word_count": words})


def rename_take(db: Session, node: StructureNode, take: SceneTake, label: str, *, actor_id, client_id) -> None:
    takes = takes_of(db, node)
    change = _Change(db, node, f"Rename {name_of(takes, take)} of “{_title(node)}”", actor_id, client_id)
    change.update(take, "scene_take", {"label": label.strip()[:80]})


def delete_take(db: Session, node: StructureNode, take: SceneTake, *, actor_id, client_id) -> None:
    """Delete a take that does not count. Down to one take, the scene has no rows again, and the
    take that counts is simply its prose. Does not commit."""
    if take.counts:
        raise TakeError("This is the take that counts. Choose another to count first, then delete this one.")
    takes = takes_of(db, node)
    change = _Change(db, node, f"Delete {name_of(takes, take)} of “{_title(node)}”", actor_id, client_id)
    rest = [t for t in takes if t.id != take.id]
    if take.is_open:
        counting = next(t for t in rest if t.counts)
        change.update(counting, "scene_take", {"is_open": True})
    change.drop(take)
    if len(rest) == 1:
        change.drop(rest[0])


def write(db: Session, node: StructureNode, take: SceneTake, content: str, word_count: int, *, actor_id, client_id):
    """Save typing in a take that does not count: logged for the Chronicle, not undoable here
    (the editor's own history holds typing). Does not commit."""
    if take.counts:
        raise TakeError("The take that counts is the scene's prose: save it as the scene.")
    before, after = change_log.diff_fields(take, {"content": content, "word_count": word_count})
    if not before:
        return
    takes = takes_of(db, node)
    change_log.record(
        db, story_id=node.story_id, entity_type="scene_take", entity_id=take.id, action="content",
        before=before, after=after, label=f"Edit {name_of(takes, take)} of “{_title(node)}”",
        actor_id=actor_id, client_id=client_id, undoable=False,
    )  # fmt: skip
    take.content, take.word_count = content, word_count
