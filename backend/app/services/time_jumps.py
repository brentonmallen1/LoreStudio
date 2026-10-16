"""
Where a long scene's time jumps (doc 29 D6): a paragraph that opens on "By morning", "The next
day", "Three days on", "Later that night", "Weeks passed" and the like. A long scene that jumps
is offered a split there, in What you've written and in the This scene tab.

The rule, said where the offer shows: a scene of `LONG_SCENE_WORDS` words or more, with at least
one paragraph after its first that opens on one of `TIME_JUMPS`. Only the start of a paragraph
counts: "the next day" inside a sentence is a character talking about it, not the story moving.
The phrases are kept here and nowhere else; `tests/services/test_time_jumps.py` holds them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .prose_html import paragraphs
from .prose_syntax import reader_text

#: A scene this long or longer is offered a split where its time jumps (a rule of thumb: most
#: scenes run 1,000 to 2,500 words, and one past that which jumps in time is often two).
LONG_SCENE_WORDS = 2500

_COUNT = (
    r"(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|"
    r"forty|fifty|a few|a couple of|several|some|many|half an|\d+)"
)
_UNIT = r"(?:minutes?|hours?|days?|nights?|weeks?|months?|years?|seasons?|winters?|summers?)"
_PART_OF_TIME = r"(?:morning|afternoon|evening|night|day|week|month|year|spring|summer|autumn|fall|winter)"

#: How a paragraph opens when the story's time jumps, as patterns read without regard to case.
TIME_JUMPS: tuple[str, ...] = (
    r"by (?:morning|noon|midday|afternoon|evening|nightfall|dusk|dawn|daybreak|midnight)",
    rf"by the (?:next|following) {_PART_OF_TIME}",
    rf"the (?:next|following) {_PART_OF_TIME}",
    rf"next {_PART_OF_TIME}",
    rf"the {_PART_OF_TIME} after",
    rf"{_COUNT} {_UNIT} (?:later|on|passed|went by)",
    rf"{_UNIT} (?:later|passed|went by)",
    rf"later (?:that|the same) {_PART_OF_TIME}",
    r"(?:some ?time|much|(?:a )?long time) later",
    r"time passed",
    r"(?:when )?(?:morning|dawn|night|evening) came",
)

_OPENING = re.compile(rf"^(?:{'|'.join(TIME_JUMPS)})(?=[\s,.;:!?—–-]|$)", re.IGNORECASE)
#: How many words of the paragraph to quote, to find it again in the editor.
_PASSAGE_WORDS = 8
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def time_jump(text: str) -> str | None:
    """The phrase a paragraph opens on when it moves the story's time on, as written."""
    m = _OPENING.match(text.lstrip())
    return m.group(0) if m else None


@dataclass
class TimeJump:
    #: Which paragraph of the scene, counted from 0.
    index: int
    #: The phrase, as written ("Three days on").
    phrase: str
    #: The paragraph's first words, as the editor holds them, to find it there.
    passage: str


def time_jumps(html: str | None) -> list[TimeJump]:
    """Every paragraph after the scene's first that opens on a jump in time."""
    out: list[TimeJump] = []
    for i, para in enumerate(paragraphs(html or "")):
        if i == 0 or para.tag in _HEADINGS or para.element == "heading":
            continue
        phrase = time_jump(reader_text(para.text))
        if phrase:
            words = para.text.split()
            out.append(TimeJump(index=i, phrase=phrase, passage=" ".join(words[:_PASSAGE_WORDS])))
    return out


def is_long(word_count: int | None) -> bool:
    return (word_count or 0) >= LONG_SCENE_WORDS
