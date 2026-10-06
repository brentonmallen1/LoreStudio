"""
Who is on a scene's page: the rule `/scene-cast` answers with, kept here so the Numbers
readings (doc 19) measure presence exactly as the live page shows it.

A character is on the page when the scene is seen through them, when the author placed them
there, or when the prose names them; an author's "absent" outranks all three.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from typing import Any, Protocol

from .codex.presence import known_as, name_patterns, plain_text


class _Answer(Protocol):
    """A `ScenePresence` row, or the same fields read from a snapshot."""

    character_id: str
    role: str


def cast_patterns(characters: Iterable[Any]) -> dict[str, list[re.Pattern[str]]]:
    """Each character's name patterns, once per book: a name two characters share names neither."""
    return name_patterns({c.id: known_as(c) for c in characters})


def on_the_page(
    content: str | None,
    patterns: dict[str, list[re.Pattern[str]]],
    answers: Iterable[_Answer],
    pov: str | None,
) -> list[str]:
    """Character ids on a scene's page: the point of view first, then by how often the prose
    names them, with the author's own answers placed above anything read off the page."""
    text = plain_text(content or "")
    counts: Counter[str] = Counter()
    for cid, pats in patterns.items():
        hits = sum(len(p.findall(text)) for p in pats)
        if hits:
            counts[cid] = hits
    absent: set[str] = set()
    # The author's answer for a scene outranks anything read off the page: someone
    # marked absent is out even if named, someone placed here is in even if not.
    for row in answers:
        if row.role == "absent":
            absent.add(row.character_id)
            counts.pop(row.character_id, None)
        else:
            counts[row.character_id] = max(counts.get(row.character_id, 0), 1) + 1000
    ordered = [cid for cid, _ in counts.most_common()]
    # The point of view is in the scene whether or not the prose says their name:
    # a first-person narrator rarely does. An "absent" answer still wins.
    if pov and pov not in absent:
        ordered = [pov, *[c for c in ordered if c != pov]]
    return ordered
