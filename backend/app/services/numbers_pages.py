"""
A script's numbers, in pages (doc 25, P5): a page is about a minute on screen, so a script is
measured the way its readers measure it. The total is the PDF's own count (the shared
paginator); an act's share and a scene's length are its lines laid end to end, the way a
script breakdown counts them in eighths of a page.
"""

from __future__ import annotations

from ..schemas.numbers import LongScene, NumbersPages, PagesPart, WordTarget
from .findings.view import StoryView
from .script_export import pages_in
from .script_syntax import LINES_PER_PAGE, block_lines, eighths, scene_blocks
from .story_format import is_script

#: A scene longer than this many eighths (three pages) is long for the screen.
LONG_SCENE = 24
_SPEECH = ("cue", "paren", "dialogue")


def pages(view: StoryView) -> NumbersPages | None:
    """None for prose."""
    if not is_script(view.story):
        return None
    target = view.target
    total = target["current"] if target else pages_in([n.content for n in view.leaves])

    speech = action = 0
    for node in view.written:
        for element, text in scene_blocks(node.content or ""):
            n = len(block_lines(element, text))
            if element in _SPEECH:
                speech += n
            elif element == "action":
                action += n

    parts = [
        PagesPart(
            id=top.id,
            title=top.title or "Untitled",
            pages=round(sum(leaf.line_count or 0 for leaf in view.leaves_under(top)) / LINES_PER_PAGE, 1),
        )
        for top in view.children.get(None, [])
        if view.children.get(top.id)
    ]
    long = [
        LongScene(id=n.id, title=n.title or "Untitled", eighths=eighths(n.line_count or 0))
        for n in view.written
        if eighths(n.line_count or 0) > LONG_SCENE
    ]
    lengths = [eighths(n.line_count or 0) for n in view.written]
    return NumbersPages(
        total=total,
        form=view.story.intended_length or "",
        target=WordTarget(**target) if target else None,
        by_part=parts,
        dialogue_pct=round(speech / (speech + action) * 100) if speech + action else 0,
        long_scenes=long,
        mean_eighths=round(sum(lengths) / len(lengths)) if lengths else 0,
    )
