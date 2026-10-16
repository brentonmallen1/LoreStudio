"""The Outline's Not placed yet tray (doc 29 D3): ideas for what should happen, without a place.

A story's tray is its ``outlines`` row (one per story since migration 0048, which folded the
beat boards into it), and each idea is a flat ``outline_items`` row. An old snapshot or an
old Undo may bring back a second row or a nested item; the tray reads them all, in order, so
nothing put back is out of sight.
"""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from ..models.outline import Outline, OutlineItem

TRAY_NAME = "Not placed yet"

#: A title the Outline can show on one line.
TITLE_LIMIT = 60

#: Where an idea's first clause ends: a dash, a colon, a full stop, a semicolon, a question.
_CLAUSE = re.compile(r"\s[—–-]\s|[:;.?!]\s")


def tray_of(db: Session, story_id: str) -> Outline | None:
    """The story's tray, or None before its first idea."""
    return (
        db.query(Outline)
        .filter(Outline.story_id == story_id)
        .order_by(Outline.position.asc(), Outline.created_at.asc(), Outline.id.asc())
        .first()
    )


def ideas_of(db: Session, story_id: str) -> list[OutlineItem]:
    """Every idea in the story's tray, in the writer's order."""
    return (
        db.query(OutlineItem)
        .join(Outline, Outline.id == OutlineItem.outline_id)
        .filter(Outline.story_id == story_id)
        .order_by(Outline.position.asc(), Outline.created_at.asc(), OutlineItem.position.asc(), OutlineItem.id.asc())
        .all()
    )


def idea_to_scene(text: str) -> tuple[str, str]:
    """A placed idea's scene title and what happens in it.

    A short idea is the title. A longer one keeps all its words as what happens, under a
    title made of its first clause ("The Tremor — Elena notices…" is "The Tremor"), or of its
    first words when the first clause runs long.
    """
    text = " ".join(text.split())
    if len(text) <= TITLE_LIMIT:
        return text, ""
    match = _CLAUSE.search(text)
    if match and 2 <= match.start() <= TITLE_LIMIT:
        return text[: match.start()].strip(), text
    cut = text[:TITLE_LIMIT].rsplit(" ", 1)[0].rstrip(",;:—–- ")
    return f"{cut}…", text
