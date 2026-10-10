"""Counting a scene's words, and the target ranges by intended story length."""

from .prose_html import paragraphs
from .prose_syntax import reader_text


def count_words(content_html: str | None) -> int:
    """
    Words in a scene's stored HTML, by the rule the editor counts with as you type
    (`countWordsClean` in the frontend): the prose as a reader sees it, so a speaker tag
    such as `<Calder>` is not words, a mention's words are, and a "<" in the prose ("x < 5")
    is just a character. Both run shared/prose-syntax/cases.json.

    The two have to agree. The tree shows the stored number and the editor shows its
    own, so a stored count made any other way jumps the first time the author types —
    the demo's hand-written counts were off by up to 49 words a scene.
    """
    return sum(len(reader_text(p.text).split()) for p in paragraphs(content_html or ""))


# Maps intended_length values to {min, max, soft_warning_at} in words.
# soft_warning_at = 85% of max (None for unbounded forms).
WORD_COUNT_RANGES: dict[str, dict] = {
    "flash_fiction": {"min": 0, "max": 1_000, "soft_warning_at": 850},
    "short_story": {"min": 1_000, "max": 7_500, "soft_warning_at": 6_375},
    "novelette": {"min": 7_500, "max": 17_500, "soft_warning_at": 14_875},
    "novella": {"min": 17_500, "max": 40_000, "soft_warning_at": 34_000},
    "novel": {"min": 40_000, "max": 100_000, "soft_warning_at": 85_000},
    "epic_saga": {"min": 100_000, "max": None, "soft_warning_at": None},
    "series": {"min": None, "max": None, "soft_warning_at": None},
}


def get_word_count_status(intended_length: str, current_words: int) -> dict | None:
    """
    Returns word count target info for the given intended_length.
    Returns None if the form is unbounded or not recognized.
    """
    ranges = WORD_COUNT_RANGES.get(intended_length)
    if not ranges or ranges["max"] is None:
        return None

    max_words = ranges["max"]
    soft_warning = ranges["soft_warning_at"]
    pct = round(current_words / max_words * 100, 1) if max_words else 0

    if current_words >= max_words:
        warning_level = "exceeded"
    elif soft_warning and current_words >= soft_warning:
        warning_level = "approaching"
    else:
        warning_level = "normal"

    return {
        "min": ranges["min"],
        "max": max_words,
        "soft_warning_at": soft_warning,
        "current": current_words,
        "pct": pct,
        "warning_level": warning_level,
    }


def count_lines(story, html: str | None) -> int:
    """A script scene's length in lines of the printed page; 0 for prose (doc 25)."""
    from . import script_syntax
    from .story_format import is_script

    return script_syntax.scene_lines(script_syntax.scene_blocks(html or "")) if is_script(story) else 0


def recount_story(story_id: str, db) -> int:
    """Set every node's stored counts from its content. Returns how many changed."""
    from ..models.story import Story
    from ..models.structure import StructureNode

    story = db.get(Story, story_id)
    changed = 0
    for node in db.query(StructureNode).filter(StructureNode.story_id == story_id):
        n = count_words(node.content)
        lines = count_lines(story, node.content)
        if node.word_count != n or (node.line_count or 0) != lines:
            node.word_count = n
            node.line_count = lines
            changed += 1
    return changed
