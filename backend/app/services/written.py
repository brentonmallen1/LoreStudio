"""
What you've written (doc 29 D6): the discovery loop's view of the story, all of it read from the
prose on this computer, with no AI.

- **People and places you've written about:** each Lorebook character and place with how often the
  prose names them, by the same name rule as presence (`codex.presence.name_patterns`), and the
  scenes they are in (`scene_cast.on_the_page`: named, seen through, or placed there).
- **New names:** what Discoveries' local name scan found that the Lorebook lacks, with its yes and
  no, so the writer can answer here or there.
- **When you're ready to tidy up:** a long scene where the time jumps (`time_jumps`), and a
  chapter holding `MANY_SCENES` scenes or more, to wrap some in chapters of their own. Each offer
  can be put off with "Not now", kept per story as a `ProposalDecline` under a `tidy:` key.
"""

from __future__ import annotations

import re
import uuid
from collections import Counter

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.location import Location, ScenePresence
from ..models.proposal_decline import ProposalDecline
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.written import ChaptersOffer, Jump, NameAction, NamedCount, NewName, SplitOffer, WrittenOut
from . import change_log
from .codex.presence import known_as, name_patterns
from .findings.runs import latest_runs
from .held_prose import template_levels
from .proposals.sources import scanned_names, scene_titles, stubs
from .prose_html import paragraphs
from .prose_syntax import reader_text
from .scene_cast import on_the_page
from .structure_order import order_of
from .structure_scaffold import FLAT
from .time_jumps import LONG_SCENE_WORDS, is_long, time_jumps

#: A part holding this many scenes or more is offered chapters (a rule of thumb, said where it shows).
MANY_SCENES = 8
#: A "Not now" is kept under this prefix, beside the Discoveries' declines.
TIDY = "tidy:"
_KEY = re.compile(r"^(split|chapters):[A-Za-z0-9-]+$")


def scenes_of(story_id: str, db: Session) -> list[StructureNode]:
    """The story's scenes (the nodes that hold no others), in reading order."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    order = order_of(nodes)
    parents = {n.parent_id for n in nodes}
    return sorted((n for n in nodes if n.id not in parents), key=lambda n: order.get(n.id, 0))


def put_off(story_id: str, db: Session) -> set[str]:
    """The offers the writer said "Not now" to, by key ("split:<id>")."""
    rows = db.query(ProposalDecline.fingerprint).filter(
        ProposalDecline.story_id == story_id, ProposalDecline.fingerprint.startswith(TIDY)
    )
    return {f.removeprefix(TIDY) for (f,) in rows}


def not_now(story_id: str, key: str, db: Session, *, actor_id: str | None, client_id: str | None) -> bool:
    """Keep "Not now" for an offer, as a change ⌘Z takes back. False for a key no offer has."""
    if not _KEY.match(key):
        return False
    fingerprint = TIDY + key
    exists = (
        db.query(ProposalDecline)
        .filter(ProposalDecline.story_id == story_id, ProposalDecline.fingerprint == fingerprint)
        .first()
    )
    if exists is None:
        row = ProposalDecline(id=str(uuid.uuid4()), story_id=story_id, fingerprint=fingerprint)
        db.add(row)
        db.flush()
        change_log.record_row_create(
            db, row, "proposal_declines", entity_type="proposal_decline", story_id=story_id,
            label="Not now: a tidy-up offer", actor_id=actor_id, client_id=client_id,
        )  # fmt: skip
    return True


def reader_prose(html: str | None) -> str:
    """The prose as a reader meets it: no tags, and no `<Name>` after a line, which says who
    speaks but is not the prose naming them."""
    return "\n".join(reader_text(p.text) for p in paragraphs(html or ""))


def split_offer(node: StructureNode) -> SplitOffer | None:
    """The scene's offer to split where its time jumps, when it is long and jumps."""
    if not is_long(node.word_count):
        return None
    jumps = time_jumps(node.content)
    if not jumps:
        return None
    return SplitOffer(
        node_id=node.id,
        title=node.title or "Untitled",
        words=node.word_count or 0,
        jumps=[Jump(phrase=j.phrase, passage=j.passage) for j in jumps],
        long_scene_words=LONG_SCENE_WORDS,
    )


def chapters_offers(story: Story, db: Session, later: set[str]) -> list[ChaptersOffer]:
    """Parts at the level above scenes that hold `MANY_SCENES` scenes or more, in a shape that
    has such a level: "wrap some in chapters of their own"."""
    levels = template_levels(story, db)
    if story.structure_template_id in FLAT or len(levels) < 2:
        return []
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()
    order = order_of(nodes)
    held: Counter[str] = Counter(n.parent_id for n in nodes if n.parent_id)
    holders = {n.parent_id for n in nodes if n.parent_id in held and n.id not in held}
    parts = sorted((n for n in nodes if n.id in holders), key=lambda n: order.get(n.id, 0))
    level = (levels[-2].get("name") or "part").lower()
    return [
        ChaptersOffer(
            part_id=n.id, title=n.title or "Untitled", scenes=held[n.id], level=level, many_scenes=MANY_SCENES
        )
        for n in parts
        if held[n.id] >= MANY_SCENES and f"chapters:{n.id}" not in later
    ]


def _counts(texts: dict[str, str], patterns: dict[str, list[re.Pattern[str]]]) -> tuple[Counter, Counter]:
    times: Counter[str] = Counter()
    scenes: Counter[str] = Counter()
    for text in texts.values():
        for key, pats in patterns.items():
            hits = sum(len(p.findall(text)) for p in pats)
            if hits:
                times[key] += hits
                scenes[key] += 1
    return times, scenes


def _yes(label: str, kind: str) -> str:
    """The yes in the Overview's words: a person, a place ("Add as a character" in Discoveries)."""
    return label if label.startswith("Add as a p") else ("Add as a person" if kind == "person" else "Add as a place")


def _most_named(x: NamedCount | NewName) -> tuple[int, int, str]:
    return (-x.times, -getattr(x, "scenes", 0), x.name.lower())


def written(story_id: str, db: Session) -> WrittenOut:
    scenes = scenes_of(story_id, db)
    texts = {n.id: reader_prose(n.content) for n in scenes if n.content}

    cast = db.query(Character).filter(Character.story_id == story_id).all()
    who = name_patterns({c.id: known_as(c) for c in cast})
    times, _ = _counts(texts, who)
    answers: dict[str, list[ScenePresence]] = {}
    for row in db.query(ScenePresence).filter(ScenePresence.node_id.in_([n.id for n in scenes])):
        answers.setdefault(row.node_id, []).append(row)
    in_scenes: Counter[str] = Counter()
    for n in scenes:
        in_scenes.update(on_the_page(n.content, who, answers.get(n.id, []), n.pov_character_id))
    people = [
        NamedCount(id=c.id, name=c.name, times=times[c.id], scenes=in_scenes[c.id], color_slot=c.color_slot)
        for c in cast
        if times[c.id] or in_scenes[c.id]
    ]

    places_known = [
        loc for loc in db.query(Location).filter(Location.story_id == story_id) if not loc.is_stub and loc.name
    ]
    p_times, p_scenes = _counts(
        texts, name_patterns({loc.id: [loc.name, *(loc.aliases or [])] for loc in places_known})
    )
    places = [
        NamedCount(id=loc.id, name=loc.name, times=p_times[loc.id], scenes=p_scenes[loc.id], color_slot=loc.color_slot)
        for loc in places_known
        if p_times[loc.id]
    ]

    titles = scene_titles(story_id, db)
    declined = {f for (f,) in db.query(ProposalDecline.fingerprint).filter(ProposalDecline.story_id == story_id)}
    found = [
        p
        for p in [*scanned_names(story_id, db, titles), *stubs(story_id, db, titles)]
        if p.id not in declined and p.source == "local" and p.kind in ("person", "place") and p.actions
    ]
    n_times = {p.id: _counts(texts, name_patterns({p.id: p.subject}))[0][p.id] for p in found}
    new_names = [
        NewName(
            proposal_id=p.id,
            kind="person" if p.kind == "person" else "place",
            name=p.subject,
            times=n_times[p.id],
            actions=[NameAction(id=a.id, label=_yes(a.label, p.kind)) for a in p.actions],
            decline=p.decline,
        )
        for p in found
    ]

    later = put_off(story_id, db)
    offers = [o for n in scenes if f"split:{n.id}" not in later and (o := split_offer(n))]
    scan = latest_runs(story_id, db).get("entity-suggestions")
    story = db.get(Story, story_id)
    return WrittenOut(
        people=sorted(people, key=_most_named),
        places=sorted(places, key=_most_named),
        new_names=sorted(new_names, key=_most_named),
        last_scan=scan.created_at if scan else None,
        split_offers=offers,
        chapters_offers=chapters_offers(story, db, later) if story else [],
    )
