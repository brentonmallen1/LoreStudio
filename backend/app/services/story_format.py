"""
What a story is written as (doc 25): prose, or a screenplay.

The format decides how a scene is written and read: a screenplay's blocks are elements
(scene heading, action, cue, dialogue…), its length is pages, and the prose-only checks
and AI features stand aside. Anything that behaves differently for a script asks here
rather than comparing strings itself. A stage play joins as a third format in doc 25 P9.
"""

from typing import Literal

StoryFormat = Literal["prose", "screenplay"]

FORMATS: tuple[str, ...] = ("prose", "screenplay")

#: The built-in structures written for one format. The others, and the author's own, fit any.
TEMPLATE_FORMATS: dict[str, str] = {
    "screenplay": "screenplay",
    "screenplay-sequences": "screenplay",
}


def is_script(story) -> bool:
    """Whether the story is written in script elements rather than prose."""
    return bool(story) and (getattr(story, "story_format", None) or "prose") != "prose"


def template_format(template_id: str | None) -> str:
    """The format a structure template was written for, or "" when it fits any."""
    return TEMPLATE_FORMATS.get(template_id or "", "")
