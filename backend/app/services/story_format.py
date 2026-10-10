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


#: The local checks a script runs (doc 25, P5), and what they read: its action lines, which are
#: written like prose. Said-bookisms (a cue names the speaker), point of view (a script has no
#: narrator) and sentence variety (action is terse by design) do not run on a script; tense
#: does, expecting the present: action happens as we watch.
SCRIPT_CHECKS: frozenset[str] = frozenset({"passive_voice", "adverb_overuse", "repeated_words"})


def is_script(story) -> bool:
    """Whether the story is written in script elements rather than prose."""
    return bool(story) and (getattr(story, "story_format", None) or "prose") != "prose"


def action_html(html: str | None) -> str:
    """A script scene's action lines alone, as paragraphs, for the checks that read prose."""
    from html import escape

    from .script_syntax import scene_blocks

    return "".join(f"<p>{escape(text)}</p>" for el, text in scene_blocks(html or "") if el == "action")


def spoken_and_action_html(html: str | None) -> str:
    """A script scene's action and dialogue, without cues, headings or transitions (the
    name scan would take every ALL CAPS cue and heading for a stranger)."""
    from html import escape

    from .script_syntax import scene_blocks

    return "".join(f"<p>{escape(t)}</p>" for el, t in scene_blocks(html or "") if el in ("action", "dialogue"))


def template_format(template_id: str | None) -> str:
    """The format a structure template was written for, or "" when it fits any."""
    return TEMPLATE_FORMATS.get(template_id or "", "")
