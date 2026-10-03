"""
References that outlive what they point at (doc 18, B1).

A thread's opening and closing scenes, its try/fail scenes, a twist's reveal and clue scenes, an
event's scene, and "characters who know" are plain ids or JSON, so deleting a scene or a
character left them pointing at nothing (or nulled them where undo could not bring them back).
Each is cleared here as a recorded update in the delete's own batch, recorded before the
delete, so one Undo restores the scene or character first and then puts every reference back.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.plot_thread import PlotThread
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.twist import Twist
from . import change_log


def _apply(db, obj, data, *, entity_type, story_id, label, actor_id, client_id, batch_id) -> None:
    after = change_log.record_update(
        db,
        obj,
        data,
        entity_type=entity_type,
        story_id=story_id,
        label=label,
        actor_id=actor_id,
        client_id=client_id,
        batch_id=batch_id,
    )
    for key, value in (after or {}).items():
        setattr(obj, key, value)


def detach_scenes(db: Session, story_id: str, node_ids: set[str], *, actor_id, client_id) -> str:
    """Clear every reference to `node_ids`; returns the batch id the delete must share."""
    batch = str(uuid.uuid4())
    common = {"story_id": story_id, "actor_id": actor_id, "client_id": client_id, "batch_id": batch}
    for t in db.query(PlotThread).filter(PlotThread.story_id == story_id).all():
        data: dict = {}
        if t.opens_at_node_id in node_ids:
            data["opens_at_node_id"] = None
        if t.closes_at_node_id in node_ids:
            data["closes_at_node_id"] = None
        cycles = t.try_fail_cycles or []
        if any(c.get("node_id") in node_ids for c in cycles):
            data["try_fail_cycles"] = [{**c, "node_id": None} if c.get("node_id") in node_ids else c for c in cycles]
        if data:
            _apply(db, t, data, entity_type="plot_thread", label=f"Detach {{fields}} on thread {t.name}", **common)
    for tw in db.query(Twist).filter(Twist.story_id == story_id).all():
        data = {}
        if tw.revealed_at_node_id in node_ids:
            data["revealed_at_node_id"] = None
        clues = tw.clues or []
        if any(c.get("node_id") in node_ids for c in clues):
            data["clues"] = [{**c, "node_id": None} if c.get("node_id") in node_ids else c for c in clues]
        if data:
            _apply(db, tw, data, entity_type="twist", label=f"Detach {{fields}} on twist {tw.name}", **common)
    for ev in (
        db.query(ReaderKnowledgeEvent)
        .filter(ReaderKnowledgeEvent.story_id == story_id, ReaderKnowledgeEvent.node_id.in_(node_ids))
        .all()
    ):
        _apply(
            db,
            ev,
            {"node_id": None},
            entity_type="reader_knowledge_event",
            label=f"Detach the scene of {ev.subject}",
            **common,
        )
    return batch


def detach_character(db: Session, story_id: str, character_id: str, *, actor_id, client_id) -> str:
    """Take a deleted character out of every "who knows"; returns the delete's batch id."""
    batch = str(uuid.uuid4())
    for ev in db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id).all():
        who = ev.characters_who_know or []
        if character_id in who:
            _apply(
                db,
                ev,
                {"characters_who_know": [c for c in who if c != character_id]},
                entity_type="reader_knowledge_event",
                story_id=story_id,
                label=f"Detach a character from {ev.subject}",
                actor_id=actor_id,
                client_id=client_id,
                batch_id=batch,
            )
    return batch
