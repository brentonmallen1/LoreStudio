"""
Talking to each other (doc 20 P7): the first part of the Bechdel–Wallace test, measured, and
in Studio the second described. Never a score, a pass or a fail (D4).

Who counts comes from the author's own Gender field, never from pronouns or names. The group
starts as the values that say "woman"; the author can look at any other group the same way, one
at a time, and there is no breakdown of every group together.

Dialogue blocks have a speaker and an order but no addressee, so "to each other" is proximity:
an exchange is two or more consecutive attributed lines in a scene from at least two people in
the group, with nobody outside it speaking between. An unattributed line breaks an exchange, so
better attribution gives a better answer, and the page says so.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.dialogue import DialogueBlock
from .dialogue_service import sync_story_dialogue
from .findings.runs import latest_runs, result_of
from .findings.view import StoryView

FEATURE = "talk-subjects"
_WOMAN = re.compile(r"\bwom[ae]n\b", re.I)


def _key(value: str) -> str:
    return " ".join((value or "").split()).lower()


def gender_values(characters: list[Any]) -> list[tuple[str, int]]:
    """The gender values the author wrote, each once (as first written), with how many have it."""
    counts: Counter[str] = Counter()
    shown: dict[str, str] = {}
    for c in characters:
        k = _key(getattr(c, "gender", ""))
        if k:
            counts[k] += 1
            shown.setdefault(k, " ".join(c.gender.split()))
    return [(shown[k], n) for k, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def default_group(values: list[str]) -> list[str]:
    """The values that say "woman" (woman, trans woman, …)."""
    return [v for v in values if _WOMAN.search(v)]


@dataclass
class Exchange:
    speakers: list[str]
    lines: list[Any] = field(default_factory=list)

    @property
    def id(self) -> str:
        """Its words, hashed: a description of it lapses when its prose changes."""
        text = "\n".join(f"{b.character_id}:{b.content}" for b in self.lines)
        return hashlib.sha1(text.encode()).hexdigest()[:16]


def exchanges(blocks: list[Any], group: set[str]) -> list[Exchange]:
    """The exchanges in one scene's dialogue blocks, in order."""
    out: list[Exchange] = []
    run: list[Any] = []

    def close() -> None:
        speakers = list(dict.fromkeys(b.character_id for b in run))
        if len(run) >= 2 and len(speakers) >= 2:
            out.append(Exchange(speakers, list(run)))
        run.clear()

    for b in sorted(blocks, key=lambda b: (b.paragraph_index, b.position_in_paragraph)):
        if b.character_id and b.character_id in group:
            run.append(b)
        else:  # someone outside the group, or a line nobody has been given to
            close()
    close()
    return out


@dataclass
class _Read:
    values: list[tuple[str, int]]
    keys: set[str]
    group: set[str]
    by_scene: dict[str, list[Any]]


def _read(view: StoryView, db: Session, genders: list[str] | None) -> _Read:
    """The gender values, the chosen group, and every scene's spoken lines (thoughts are nobody's)."""
    sync_story_dialogue(view.story.id, db)
    values = gender_values(view.characters)
    chosen = genders if genders is not None else default_group([v for v, _ in values])
    keys = {_key(g) for g in chosen}
    group = {c.id for c in view.characters if _key(getattr(c, "gender", "")) in keys}
    ids = [n.id for n in view.leaves]
    blocks = (
        db.query(DialogueBlock)
        .filter(
            DialogueBlock.scene_id.in_(ids),
            or_(DialogueBlock.dialogue_type.is_(None), DialogueBlock.dialogue_type != "thought"),
        )
        .all()
        if ids
        else []
    )
    by_scene: dict[str, list[Any]] = {}
    for b in blocks:
        by_scene.setdefault(b.scene_id, []).append(b)
    return _Read(values, keys, group, by_scene)


def talk(view: StoryView, db: Session, genders: list[str] | None) -> dict:
    """The section's figures: the values to choose from, the group, and each scene's exchanges."""
    r = _read(view, db, genders)
    run = latest_runs(view.story.id, db).get(FEATURE)
    described = (result_of(run).get("exchanges") or {}) if run else {}
    scenes = []
    for n in view.leaves:
        found = exchanges(r.by_scene.get(n.id, []), r.group)
        if found:
            scenes.append(
                {
                    "node_id": n.id,
                    "title": n.title or "Untitled",
                    "exchanges": [
                        {"id": e.id, "speakers": e.speakers, "lines": len(e.lines), **(described.get(e.id) or {})}
                        for e in found
                    ],
                }
            )
    in_group = {sid for sid, bs in r.by_scene.items() if any(b.character_id in r.group for b in bs)}
    return {
        "values": [{"value": v, "count": n} for v, n in r.values],
        "group": [v for v, _ in r.values if _key(v) in r.keys],
        "people": len(r.group),
        "scenes": scenes,
        "scene_count": len(view.leaves),
        "unattributed": sum(1 for sid in in_group for b in r.by_scene[sid] if not b.character_id),
        "described_at": run.created_at.isoformat() if run else None,
    }


def exchange_text(view: StoryView, db: Session, genders: list[str] | None) -> list[dict]:
    """Each exchange's lines, for the Assistant: who said what, by name, in order."""
    r = _read(view, db, genders)
    names = {c.id: c.name for c in view.characters}
    titles = {n.id: n.title or "Untitled" for n in view.leaves}
    return [
        {
            "id": e.id,
            "scene": titles[n.id],
            "lines": [f"{names.get(b.character_id, '?')}: {b.content}" for b in e.lines],
        }
        for n in view.leaves
        for e in exchanges(r.by_scene.get(n.id, []), r.group)
    ]
