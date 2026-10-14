"""Tropes in play (doc 27): reading them out, and saying them to the model.

A trope's thread and definition are plain ids (no foreign key), so a deleted thread or entry
comes back on undo with its link intact. Until then the id names nothing, and reads as none.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.character import Character, CharacterRelationship
from ..models.compendium import CompendiumEntry
from ..models.plot_thread import PlotThread
from ..models.structure import StructureNode
from ..models.trope import Trope, TropeLink
from ..schemas.trope import TropeLinkOut, TropeOut

#: How each stance reads in a sentence, for the model and for findings.
STANCE_PHRASES = {
    "undecided": "not decided yet",
    "straight": "played straight",
    "subverted": "subverted",
    "inverted": "inverted",
    "averted": "averted",
    "deconstructed": "deconstructed",
    "lampshaded": "lampshaded",
}


def live_thread(trope: Trope, db: Session) -> PlotThread | None:
    if not trope.thread_id:
        return None
    thread = db.get(PlotThread, trope.thread_id)
    return thread if thread is not None and thread.story_id == trope.story_id else None


def live_definition(trope: Trope, db: Session) -> CompendiumEntry | None:
    if not trope.definition_id:
        return None
    entry = db.get(CompendiumEntry, trope.definition_id)
    return entry if entry is not None and entry.story_id == trope.story_id else None


def trope_out(trope: Trope, db: Session) -> TropeOut:
    thread = live_thread(trope, db)
    definition = live_definition(trope, db)
    return TropeOut(
        id=trope.id,
        story_id=trope.story_id,
        name=trope.name,
        stance=trope.stance,
        why=trope.why or "",
        thread_id=thread.id if thread else None,
        definition_id=definition.id if definition else None,
        position=trope.position,
        links=[TropeLinkOut.model_validate(link) for link in trope.links],
        created_at=trope.created_at,
        updated_at=trope.updated_at,
    )


def link_target_name(link: TropeLink, db: Session) -> str:
    """Where a link points, in words: a character's name, "A and B", or a scene's title."""
    if link.character_id:
        character = db.get(Character, link.character_id)
        return character.name if character else "a character"
    if link.relationship_id:
        rel = db.get(CharacterRelationship, link.relationship_id)
        if rel is None:
            return "a relationship"
        a, b = db.get(Character, rel.character_id), db.get(Character, rel.related_character_id)
        return f"{a.name if a else '?'} and {b.name if b else '?'}"
    node = db.get(StructureNode, link.node_id) if link.node_id else None
    return f"“{node.title or 'Untitled'}”" if node else "a scene"


def describe(trope: Trope) -> str:
    """One line for the model: the name, the stance, and why. Never the definition: a model
    knows the trope; what it cannot guess is what this author means to do with it."""
    line = f"{trope.name} — {STANCE_PHRASES.get(trope.stance, trope.stance)}"
    why = (trope.why or "").strip()
    return f"{line}: {why}" if why else line


def story_tropes(story_id: str, db: Session) -> list[Trope]:
    return db.query(Trope).filter(Trope.story_id == story_id).order_by(Trope.position.asc()).all()


def whole_story(tropes: list[Trope]) -> list[Trope]:
    """The tropes with no links: they apply to the story as a whole."""
    return [t for t in tropes if not t.links]


def for_character(tropes: list[Trope], character_id: str, rel_ids: set[str]) -> list[Trope]:
    return [
        t for t in tropes if any(lk.character_id == character_id or lk.relationship_id in rel_ids for lk in t.links)
    ]


def for_scene(tropes: list[Trope], node_id: str) -> list[tuple[Trope, TropeLink]]:
    out = []
    for t in tropes:
        for lk in t.links:
            if lk.node_id == node_id:
                out.append((t, lk))
    return out
