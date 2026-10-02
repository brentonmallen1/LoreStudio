"""Data checks: what the story's own records say, no prose reading beyond names (doc 12 P3).

Moved here from the Story Health endpoints, which computed the same absences twice. Sized
to the story: chapter checks only when it has chapters, target checks only with a target.
"""

from __future__ import annotations

from ...models.character import Character
from ...models.structure import StructureNode
from ...schemas.findings import Finding, FindingAnchor
from ..codex.presence import known_as, name_patterns
from ..mice_validation import validate_thread_nesting
from ..word_count import get_word_count_status
from .make import make
from .view import StoryView

RECENT_SCENE_WINDOW = 5
#: Tertiary characters are background by design; their absence is not news.
SIGNIFICANT_ROLES = {"protagonist", "deuteragonist", "antagonist", "love_interest", "confidant", "foil"}
#: A thread this many scenes long with no try/fail cycle is worth a look.
THIN_THREAD_SCENES = 3


def absent_characters(view: StoryView) -> list[tuple[Character, StructureNode]]:
    """Significant characters seen earlier but not in the last few written scenes, with
    the scene they were last in."""
    written = [n for n in view.leaves if (n.word_count or 0) > 0]
    if len(written) < RECENT_SCENE_WINDOW:
        return []
    recent = {n.id for n in view.leaves[-RECENT_SCENE_WINDOW:]}
    patterns = name_patterns({c.id: known_as(c) for c in view.characters})
    out: list[tuple[Character, StructureNode]] = []
    for c in view.characters:
        if c.role not in SIGNIFICANT_ROLES:
            continue
        seen = [n for n in view.leaves if n.content and any(p.search(n.content) for p in patterns.get(c.id, []))]
        if seen and not any(n.id in recent for n in seen):
            out.append((c, seen[-1]))
    return out


def mice_violations(view: StoryView) -> list[dict]:
    return validate_thread_nesting(view.threads, [n.id for n in view.leaves])


def computed(view: StoryView) -> list[Finding]:
    out: list[Finding] = []
    for c, last in absent_characters(view):
        out.append(
            make(
                "absent_character",
                "cast",
                "mid",
                "data",
                f"{c.name} has not been on the page for the last {RECENT_SCENE_WINDOW} scenes",
                anchor=FindingAnchor(character_id=c.id),
                key=c.id,
                evidence=f"Last in {last.title or 'an untitled scene'}",
                where=c.name,
                action="open_sheet",
            )
        )
    for v in mice_violations(view):
        out.append(
            make(
                "mice_nesting",
                "structure",
                "mid",
                "data",
                v["message"],
                anchor=FindingAnchor(thread_id=v["thread_id"]),
                key=f"{v['thread_id']}:{v.get('conflicting_thread_id')}",
                where=v["thread_name"],
                action="open_sheet",
            )
        )
    for t in view.threads:
        scenes = len(t.appearances or [])
        if t.status != "resolved" and scenes >= THIN_THREAD_SCENES and not (t.try_fail_cycles or []):
            out.append(
                make(
                    "thin_try_fail",
                    "structure",
                    "low",
                    "data",
                    f"{t.name} runs through {scenes} scenes without a try/fail cycle",
                    anchor=FindingAnchor(thread_id=t.id),
                    key=t.id,
                    suggestion="What does someone try here, and how does it go wrong?",
                    where=t.name,
                    action="open_sheet",
                )
            )
    if view.sizing.has_chapters:
        out += _chapters(view)
    if view.sizing.has_target:
        out += _target(view)
    return out


def _chapters(view: StoryView) -> list[Finding]:
    """A chapter with no words between written ones is a hole; one with no words and no
    plan at all is a placeholder. A planned, unwritten chapter at the end is just ahead."""
    words = [sum(leaf.word_count or 0 for leaf in view.leaves_under(ch)) for ch in view.chapters]
    last_written = max((i for i, w in enumerate(words) if w), default=-1)
    out: list[Finding] = []
    for i, ch in enumerate(view.chapters):
        if words[i]:
            continue
        name = ch.title or f"Chapter {i + 1}"
        if i < last_written:
            text, sev = f"{name} is empty, but the chapters after it are written", "mid"
        elif not (ch.synopsis or "").strip() and not (ch.purpose or "").strip():
            text, sev = f"{name} has no words and no plan yet", "low"
        else:
            continue
        out.append(
            make(
                "empty_chapter",
                "structure",
                sev,
                "data",
                text,
                anchor=FindingAnchor(node_id=ch.id),
                key=ch.id,
                where=name,
                action="open_chapter",
            )
        )
    return out


def _target(view: StoryView) -> list[Finding]:
    total = sum(n.word_count or 0 for n in view.leaves)
    status = get_word_count_status(view.story.intended_length or "", total)
    if not status or status["warning_level"] == "normal":
        return []
    form = (view.story.intended_length or "").replace("_", " ")
    over = status["warning_level"] == "exceeded"
    return [
        make(
            "word_target",
            "structure",
            "mid" if over else "low",
            "data",
            f"{total:,} words: past the {status['max']:,} a {form} usually runs to"
            if over
            else f"{total:,} words: nearing the {status['max']:,} a {form} usually runs to",
            key=status["warning_level"],
            suggestion="Is this still the form you mean it to be?",
            where="Story identity",
            action="open_sheet",
        )
    ]
