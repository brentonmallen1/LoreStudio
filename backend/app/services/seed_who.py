"""
Who are they (doc 20) in the demos: drawn from canon the seed already wrote, so the sheet shows
how the fields are meant to be used rather than inventing a new story for them. The one piece
of new canon is Margaret's arthritis (Decision 10).

The Audition's Elena is the test case the doc began with: her Parkinson's was a sentence in her
background, how it shows was in her appearance, and the research sat unconnected in the
Compendium. Here they are one Body and mind entry, with who has been told.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.compendium import CompendiumEntry
from ..models.structure import StructureNode


def _entry(**kw: Any) -> dict:
    base = {
        "impact": "",
        "page": "",
        "known": "everyone",
        "known_to": [],
        "known_note": "",
        "revealed_in": None,
        "assistant": True,
    }
    return {**base, **kw}


def _who(db: Session, story_id: str) -> dict[str, Character]:
    return {c.name: c for c in db.query(Character).filter(Character.story_id == story_id)}


def _scene(db: Session, story_id: str, title: str) -> str | None:
    node = db.query(StructureNode).filter(StructureNode.story_id == story_id, StructureNode.title == title).first()
    return node.id if node else None


def seed_lighthouse_who(db: Session, story_id: str) -> None:
    """Eleanor, Calder, Margaret and Thomas: who they are, from The Last Lighthouse's canon."""
    who = _who(db, story_id)
    eleanor, calder = who.get("Eleanor Vance"), who.get("The Visitor (Calder)")
    margaret, thomas = who.get("Margaret Holt"), who.get("Thomas Vance")
    if eleanor:
        eleanor.gender, eleanor.age = "woman", "early forties"
        eleanor.thinking = "in maps and bearings"
        eleanor.lie = "Silence is a kind of loyalty."
        eleanor.need = "To ask the question she has been avoiding."
        eleanor.stakes = "Her father becomes a stranger, and the island stops being home."
        eleanor.sore_spots = "Being asked about her father, however gently."
        eleanor.shows_hurt = "Answers with the weather."
        eleanor.holds_on = "Years: she is still holding the night he died."
        eleanor.formative = [
            _entry(
                id="f-eleanor-father",
                title="Her father's last two months",
                when="five years before the story",
                what="She came back from the mainland when he fell ill, and he died two months after she arrived. They never talked about the logbook, or anything else that mattered.",
                impact="She stayed, kept his routine, and turned not-asking into a way of loving him. Silence feels like loyalty to her now.",
                page="The barometer read aloud to an empty room; the pencil stubs she keeps and never uses; never saying his name.",
                wound=True,
                notes=["death of a parent"],
                known="some",
                known_note="Margaret saw it happen",
            )
        ]
    if calder:
        calder.gender, calder.age = "woman", "about fifty"
        calder.takes_personally = "Nothing on the job; everything about James."
        calder.copes = "Method: lists, questions, the next fact."
        calder.formative = [
            _entry(
                id="f-calder-ardent",
                title="James and the Ardent",
                when="five years before the story",
                what="Her brother James captained the cargo vessel Ardent, which went down with all hands.",
                impact="Grief made into method: the calm she learned when falling apart wasn't an option, and a need to be right about what happened.",
                page="Folds paper into exact thirds; sits with her back to a wall; patience that is studied, not natural.",
                wound=True,
                notes=["grief", "drowning"],
                known="some",
                known_to=[eleanor.id] if eleanor else [],
                known_note="she tells Eleanor at the end",
                revealed_in=_scene(db, story_id, "What Thomas Knew"),
            )
        ]
    if margaret:
        margaret.gender, margaret.age = "woman", "74"
        margaret.family = "Married Robert, a fisherman, and buried him on the island twenty years ago."
        margaret.facets = [
            _entry(
                id="f-margaret-arthritis",
                area="moving",
                name="arthritis",
                since="the last ten winters",
                days="Plans the week around the cliff path: the walk to Eleanor's on a dry day, the garden in the mornings when her hands work best.",
                impact="She does fewer things and does them deliberately, and she has made a kind of peace with being slow.",
                page="A stick on the cliff path; small, deliberate movements; hands roughened by decades of work, cupped around a mug for warmth.",
                understood="That slow is not the same as done.",
            )
        ]
    if thomas:
        thomas.gender = "man"
    db.flush()


def seed_audition_who(db: Session, story_id: str) -> None:
    """Elena and Mira: Elena's Parkinson's as one entry, with who knows and the research behind it."""
    who = _who(db, story_id)
    elena, mira = who.get("Elena Sorokina"), who.get("Mira Osei")
    research = (
        db.query(CompendiumEntry)
        .filter(
            CompendiumEntry.story_id == story_id, CompendiumEntry.title == "Parkinson's and the Professional Musician"
        )
        .first()
    )
    if elena:
        elena.gender, elena.age = "woman", "54"
        elena.languages = "Russian, English"
        elena.thinking = "in phrases and fingerings"
        elena.lie = "Being pitied would be worse than failing."
        elena.facets = [
            _entry(
                id="f-elena-parkinsons",
                area="health",
                name="Parkinson's",
                since="diagnosed fourteen months before the story",
                days="The control she has always had now has to be rationed: practice in the mornings, the left hand rested between pieces.",
                impact="She tells no one, because being pitied would be worse than failing; the music has become the one place she still decides everything.",
                page="Very still when she isn't playing, as if conserving something; the left hand at rest in her lap.",
                understood="Precision, not pity.",
                known="some",
                known_note="her doctor and her accompanist",
                revealed_in=_scene(db, story_id, "The Tremor"),
                research=[research.id] if research else [],
            )
        ]
        elena.background = elena.background.replace(
            " Diagnosed with early Parkinson's fourteen months ago. She told no one except her doctor and her accompanist.",
            "",
        )
    if mira:
        mira.gender, mira.age = "woman", "17"
    db.flush()
