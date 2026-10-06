"""
References that outlive what they point at (doc 18, B1).

A twist's reveal and clue scenes, an event's scene, and "characters who know" outlive what they
name, so deleting a scene or a character left them pointing at nothing (or nulled them where
undo could not bring them back). A thread's scenes, roles included, are its appearances, which
go with the scene and come back with it (doc 18 C1).
Each is cleared here as a recorded update in the delete's own batch, recorded before the
delete, so one Undo restores the scene or character first and then puts every reference back.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.twist import Twist, TwistClue
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


def _without(entry: dict, scenes, people, research) -> dict:
    """One entry with the gone scene, people and research taken out."""
    out = dict(entry)
    if out.get("revealed_in") in scenes:
        out["revealed_in"] = None
    out["known_to"] = [c for c in out.get("known_to") or [] if c not in people]
    if "research" in out:
        out["research"] = [r for r in out["research"] or [] if r not in research]
    return out


def _detach_entries(db, story_id: str, *, scenes=frozenset(), people=frozenset(), research=frozenset(), **common):
    """Who are they (doc 20): Body and mind and What formed them name the scene where the reader
    learns each, who knows it and the research behind it. Gone ones are cleared, recorded."""
    for character in db.query(Character).filter(Character.story_id == story_id).all():
        data = {}
        for column in ("facets", "formative"):
            entries = getattr(character, column) or []
            cleaned = [_without(e, scenes, people, research) for e in entries]
            if any(_differs(a, b) for a, b in zip(entries, cleaned, strict=True)):
                data[column] = cleaned
        if data:
            _apply(
                db,
                character,
                data,
                entity_type="character",
                story_id=story_id,
                label=f"Detach what was deleted from {character.name}",
                **common,
            )


def _differs(before: dict, after: dict) -> bool:
    return any(before.get(k) != after.get(k) for k in ("revealed_in", "research")) or (
        (before.get("known_to") or []) != after["known_to"]
    )


def detach_scenes(db: Session, story_id: str, node_ids: set[str], *, actor_id, client_id) -> str:
    """Clear every reference to `node_ids`; returns the batch id the delete must share."""
    batch = str(uuid.uuid4())
    common = {"story_id": story_id, "actor_id": actor_id, "client_id": client_id, "batch_id": batch}
    _detach_entries(db, story_id, scenes=frozenset(node_ids), actor_id=actor_id, client_id=client_id, batch_id=batch)
    for tw in db.query(Twist).filter(Twist.story_id == story_id, Twist.revealed_at_node_id.in_(node_ids)).all():
        _apply(
            db,
            tw,
            {"revealed_at_node_id": None},
            entity_type="twist",
            label=f"Detach {{fields}} on twist {tw.name}",
            **common,
        )
    for clue in (
        db.query(TwistClue)
        .join(Twist, Twist.id == TwistClue.twist_id)
        .filter(Twist.story_id == story_id, TwistClue.node_id.in_(node_ids))
        .all()
    ):
        _apply(
            db,
            clue,
            {"node_id": None},
            entity_type="twist_clue",
            label=f"Detach the scene of a clue for {clue.twist.name}",
            **common,
        )
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
    _detach_entries(
        db, story_id, people=frozenset({character_id}), actor_id=actor_id, client_id=client_id, batch_id=batch
    )
    return batch


def detach_research(db: Session, story_id: str, entry_id: str, *, actor_id, client_id) -> str:
    """Take a deleted Compendium entry out of every Body and mind entry's research."""
    batch = str(uuid.uuid4())
    _detach_entries(
        db, story_id, research=frozenset({entry_id}), actor_id=actor_id, client_id=client_id, batch_id=batch
    )
    return batch
