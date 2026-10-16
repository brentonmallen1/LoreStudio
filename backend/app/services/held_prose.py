"""Prose held outside any scene: a chapter (or an act) with words of its own.

An import used to leave the text before a chapter's first break on the chapter, and a chapter
with no break all of it. The strip, the editor, the export and Numbers read only scenes, so that
prose went missing from them. The author can give it a scene of its own: a new first child (a
chapter named for an act, then a scene) takes the words, as one change ⌘Z takes back whole.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.dialogue import DialogueBlock
from ..models.note import Note
from ..models.story import Story
from ..models.structure import StoryStructureTemplate, StructureNode
from . import change_log
from .script_scene import _NOTE_ID
from .structure_scaffold import FLAT


def template_levels(story: Story | None, db: Session) -> list[dict]:
    template_id = story.structure_template_id if story else None
    template = db.get(StoryStructureTemplate, template_id) if template_id else None
    return list(template.levels) if template else []


def holders(nodes: list[StructureNode], levels: list[dict], *, flat: bool = False) -> list[StructureNode]:
    """The nodes above the deepest level that hold words of their own. A flat shape (Single
    MICE) has its levels side by side, each a kind of scene: nothing there is above a scene."""
    if flat:
        return []
    deepest = len(levels) - 1
    return [n for n in nodes if n.level < deepest and (n.word_count or 0) > 0]


def give_scene(
    db: Session,
    node: StructureNode,
    levels: list[dict],
    *,
    actor_id: str | None,
    client_id: str | None,
    batch: str | None = None,
    label: str | None = None,
) -> StructureNode:
    """Move the node's prose into a new first child at the deepest level, named for it. Its other
    children move down one. Returns the new scene. Does not commit."""
    batch = batch or str(uuid.uuid4())
    label = label or f"Give the prose in “{node.title or 'Untitled'}” a scene"
    record = {"story_id": node.story_id, "actor_id": actor_id, "client_id": client_id, "batch_id": batch}

    for child in db.query(StructureNode).filter(StructureNode.parent_id == node.id).all():
        change_log.record_update(
            db, child, {"position": child.position + 1}, entity_type="structure_node", label=label, **record
        )
        child.position += 1

    parent = node
    for level in range(node.level + 1, len(levels)):
        made = StructureNode(
            story_id=node.story_id,
            parent_id=parent.id,
            level=level,
            level_type=str(levels[level].get("name", "scene")).lower(),
            title=node.title,
            position=0,
            status=node.status if level == len(levels) - 1 else "draft",
        )
        db.add(made)
        db.flush()
        change_log.record_row_create(db, made, "structure_nodes", entity_type="structure_node", label=label, **record)
        parent = made
    scene = parent

    content = node.content or ""
    change_log.record_update(
        db,
        scene,
        {"word_count": node.word_count, "line_count": node.line_count},
        entity_type="structure_node",
        label=label,
        **record,
    )
    scene.word_count, scene.line_count = node.word_count, node.line_count
    change_log.rewrite_prose(db, scene, content, label=label, batch_id=batch, actor_id=actor_id, client_id=client_id)
    change_log.rewrite_prose(db, node, "", label=label, batch_id=batch, actor_id=actor_id, client_id=client_id)
    change_log.record_update(
        db, node, {"word_count": 0, "line_count": 0}, entity_type="structure_node", label=label, **record
    )
    node.word_count = node.line_count = 0

    # Its spoken lines and the margin notes on its words go with the prose.
    for row in db.query(DialogueBlock).filter(DialogueBlock.scene_id == node.id).all():
        change_log.record_update(db, row, {"scene_id": scene.id}, entity_type="dialogue_block", label=label, **record)
        row.scene_id = scene.id
    in_text = set(_NOTE_ID.findall(content))
    if in_text:
        for note in db.query(Note).filter(Note.node_id == node.id, Note.id.in_(in_text)).all():
            change_log.record_update(db, note, {"node_id": scene.id}, entity_type="note", label=label, **record)
            note.node_id = scene.id
    db.flush()
    return scene


def give_scenes(db: Session, story: Story, *, actor_id: str | None, client_id: str | None) -> list[StructureNode]:
    """Every holder in the story given its scene, as one change. Does not commit."""
    levels = template_levels(story, db)
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()
    found = holders(nodes, levels, flat=story.structure_template_id in FLAT)
    batch = str(uuid.uuid4())
    label = f"Give the prose in {len(found)} {'chapter' if len(found) == 1 else 'chapters'} scenes of their own"
    return [give_scene(db, n, levels, actor_id=actor_id, client_id=client_id, batch=batch, label=label) for n in found]
