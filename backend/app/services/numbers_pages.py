"""
A script's numbers, in pages (doc 25, P5): a page is about a minute on screen, so a script is
measured the way its readers measure it. The total is the PDF's own count (the shared
paginator); an act's share and a scene's length are its lines laid end to end, the way a
script breakdown counts them in eighths of a page.

`pages_of` reads rows, not models, so a reading keeps the same figures (doc 25, P11).
"""

from __future__ import annotations

from typing import Any

from ..schemas.numbers import NumbersPages
from .findings.view import StoryView
from .script_export import leaves_pages
from .script_syntax import LINES_PER_PAGE, block_lines, eighths, scene_blocks
from .story_format import is_script

#: A scene longer than this many eighths (three pages) is long for the screen.
LONG_SCENE = 24
_SPEECH = ("cue", "paren", "dialogue", "lyric")


def pages(view: StoryView) -> NumbersPages | None:
    """None for prose."""
    if not is_script(view.story):
        return None
    return NumbersPages(**pages_of(view.story, view.leaves, view.children, view.by_id, view.target))


def _leaves_under(node: Any, children: dict[str | None, list[Any]]) -> list[Any]:
    kids = children.get(node.id, [])
    return [node] if not kids else [leaf for k in kids for leaf in _leaves_under(k, children)]


def pages_of(
    story: Any,
    leaves: list[Any],
    children: dict[str | None, list[Any]],
    by_id: dict[str, Any],
    target: dict | None = None,
) -> dict[str, Any]:
    """The Pages figures from the outline's rows (``id``, ``parent_id``, ``title``, ``content``,
    ``line_count``), leaves in reading order; `target` is the story's `length_status`."""
    total = target["current"] if target else leaves_pages(story, leaves, by_id)
    written = [n for n in leaves if (n.content or "").strip()]

    speech = action = 0
    for node in written:
        for element, text in scene_blocks(node.content or ""):
            n = len(block_lines(element, text))
            if element in _SPEECH:
                speech += n
            elif element == "action":
                action += n

    lengths = [eighths(n.line_count or 0) for n in written]
    return {
        "total": total,
        "form": story.intended_length or "",
        "target": target,
        "by_part": [
            {
                "id": top.id,
                "title": top.title or "Untitled",
                "pages": round(sum(leaf.line_count or 0 for leaf in _leaves_under(top, children)) / LINES_PER_PAGE, 1),
            }
            for top in children.get(None, [])
            if children.get(top.id)
        ],
        "dialogue_pct": round(speech / (speech + action) * 100) if speech + action else 0,
        "long_scenes": [
            {"id": n.id, "title": n.title or "Untitled", "eighths": e}
            for n, e in zip(written, lengths, strict=True)
            if e > LONG_SCENE
        ],
        "mean_eighths": round(sum(lengths) / len(lengths)) if lengths else 0,
    }
