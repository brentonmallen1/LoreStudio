"""A book that strays from its series' plan (series v2): what changes from book to book.

When a series says each book is seen through someone, or set in an era, a book can drift:
the viewpoint is not in the book yet, a scene is told by someone else, a scene sits in
another era. Each is a question, not a verdict: a flashback is meant to. Nothing here
writes; an axis whose element is gone, or a book with nothing on an axis, raises nothing.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ...models.series import SeriesStory
from ...schemas.findings import Finding, FindingAnchor, FindingFix
from ..series import service
from .make import make
from .view import StoryView


def axis_findings(view: StoryView, db: Session, book: SeriesStory) -> list[Finding]:
    series = book.series
    pos = service.positions(series)
    here = f"Book {pos[view.story.id] + 1}"
    out: list[Finding] = []
    for axis in series.axes or []:
        slot = (book.slots or {}).get(axis["id"]) or {}
        element = next((e for e in series.elements if e.id == slot.get("element_id")), None)
        if element is None:
            continue
        member = service.member_in(element, view.story.id)
        if member is None:
            out.append(_missing(axis, element, here, view.story.id))
        elif axis["kind"] == "character" and axis.get("pov"):
            out += _pov(view, axis, element.name, member.ref_id, here)
        elif axis["kind"] == "era":
            out += _era(view, axis, element.name, member.ref_id, here)
    return out


def _missing(axis: dict, element, here: str, story_id: str) -> Finding:
    finding = make(
        "series-axis-missing",
        "continuity",
        "mid",
        "data",
        f"{here}'s {axis['label'].lower()} is {element.name}, who is not in it yet",
        anchor=FindingAnchor(series_element_id=element.id),
        key=f"{axis['id']}|{story_id}",
        suggestion=f"Bring {element.name} into this book from where the books before left them.",
        where=element.name,
        action="fix",
        fix=FindingFix(kind="carry", old="", new="", story_id=story_id),
    )
    return finding


def _scenes(view: StoryView):
    return [n for n in view.ordered if not view.children.get(n.id)]


def _pov(view: StoryView, axis: dict, name: str, char_id: str, here: str) -> list[Finding]:
    out: list[Finding] = []
    names = {c.id: c.name for c in view.characters}
    story_pov = view.story.pov_character_id
    if story_pov and story_pov != char_id:
        out.append(
            make(
                "series-axis-pov",
                "cast",
                "low",
                "data",
                f"{here} is seen through {name}, but the book's point of view is {names.get(story_pov, 'someone else')}",
                anchor=FindingAnchor(character_id=story_pov),
                key=f"{axis['id']}|book|{char_id}|{story_pov}",
                suggestion=f"The series plans this book through {name}'s eyes. Change the plan, or the book's POV?",
                where=view.story.title,
                action="open_sheet",
            )
        )
    for scene in _scenes(view):
        if scene.pov_character_id and scene.pov_character_id != char_id:
            teller = names.get(scene.pov_character_id, "someone else")
            out.append(
                make(
                    "series-axis-pov",
                    "cast",
                    "low",
                    "data",
                    f"“{scene.title}” is told by {teller}; {here} is seen through {name}",
                    anchor=FindingAnchor(node_id=scene.id, character_id=scene.pov_character_id),
                    key=f"{axis['id']}|{char_id}|{scene.pov_character_id}",
                    suggestion="Another viewpoint on purpose, an interlude or a prologue? Dismiss it.",
                    where=scene.title,
                    action="open_scene",
                )
            )
    return out


def _era(view: StoryView, axis: dict, name: str, era_id: str, here: str) -> list[Finding]:
    out: list[Finding] = []
    for scene in _scenes(view):
        if scene.era_id and scene.era_id != era_id:
            out.append(
                make(
                    "series-axis-era",
                    "continuity",
                    "low",
                    "data",
                    f"“{scene.title}” is set outside {name}, {here}'s {axis['label'].lower()}",
                    anchor=FindingAnchor(node_id=scene.id),
                    key=f"{axis['id']}|{era_id}|{scene.era_id}",
                    suggestion="A flashback, or a scene that belongs in another book? If it is meant, dismiss it.",
                    where=scene.title,
                    action="open_scene",
                )
            )
    return out
