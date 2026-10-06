"""
Who are they (doc 20) across a series: a character's Body and mind and What formed them name
the people who know each entry, the research behind it and the scene where the reader learns it,
all rows of the book they were written in.

Carried into another book, the people and the research become that book's own where it has
them, and the scene is left for that book to say. Characters arrive one at a time, so the link
runs both ways, as relationships do: the new copy's entries point at whoever is already there,
and those already there gain the newcomer where their own book's entries named them.
"""

from __future__ import annotations

import copy

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.series import Series
from .service import element_for_row, local_equivalent, member_in, member_row

COLUMNS = ("facets", "formative")


def _here(db: Session, series: Series, kind: str, ids: list[str], story_id: str) -> list[str]:
    found = (local_equivalent(db, series, kind, ref, story_id) for ref in ids)
    return [ref for ref in found if ref]


def carry_entries(db: Session, series: Series, src: Character, row: Character, story_id: str) -> None:
    """Point ``row``'s entries (a copy of ``src``) at ``story_id``'s rows, and the others' at ``row``."""
    for column in COLUMNS:
        entries = copy.deepcopy(getattr(row, column) or [])
        for entry in entries:
            entry["revealed_in"] = None
            entry["known_to"] = _here(db, series, "character", entry.get("known_to") or [], story_id)
            if "research" in entry:
                entry["research"] = _here(db, series, "compendium_entry", entry["research"] or [], story_id)
        setattr(row, column, entries)

    for other in db.query(Character).filter(Character.story_id == story_id, Character.id != row.id).all():
        element = element_for_row(db, "characters", other.id)
        theirs = member_in(element, src.story_id) if element else None
        original = member_row(db, theirs) if theirs else None
        if original is None:
            continue
        for column in COLUMNS:
            knew = {e.get("id"): e.get("known_to") or [] for e in getattr(original, column) or []}
            entries = copy.deepcopy(getattr(other, column) or [])
            changed = False
            for entry in entries:
                if src.id in knew.get(entry.get("id"), []) and row.id not in (entry.get("known_to") or []):
                    entry["known_to"] = [*(entry.get("known_to") or []), row.id]
                    changed = True
            if changed:
                setattr(other, column, entries)
    db.flush()
