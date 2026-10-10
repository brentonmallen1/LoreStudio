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


# What a story's intended length means, by format (doc 25, P5): {min, max, soft_warning_at},
# in words for prose and in pages for a script (a page is about a minute on screen).
# soft_warning_at is where "approaching" starts; None for unbounded forms.
LENGTH_TARGETS: dict[str, dict[str, dict]] = {
    "prose": {
        "flash_fiction": {"min": 0, "max": 1_000, "soft_warning_at": 850},
        "short_story": {"min": 1_000, "max": 7_500, "soft_warning_at": 6_375},
        "novelette": {"min": 7_500, "max": 17_500, "soft_warning_at": 14_875},
        "novella": {"min": 17_500, "max": 40_000, "soft_warning_at": 34_000},
        "novel": {"min": 40_000, "max": 100_000, "soft_warning_at": 85_000},
        "epic_saga": {"min": 100_000, "max": None, "soft_warning_at": None},
        "series": {"min": None, "max": None, "soft_warning_at": None},
    },
    "screenplay": {
        "short_film": {"min": 1, "max": 40, "soft_warning_at": 36},
        "tv_half_hour": {"min": 22, "max": 38, "soft_warning_at": 34},
        "tv_hour": {"min": 45, "max": 65, "soft_warning_at": 58},
        "feature": {"min": 90, "max": 120, "soft_warning_at": 110},
    },
}
UNITS = {"prose": "words", "screenplay": "pages"}
#: Prose's table, by its old name: the word forms.
WORD_COUNT_RANGES = LENGTH_TARGETS["prose"]


def get_word_count_status(intended_length: str, current_words: int) -> dict | None:
    """A prose story's word target (see `length_status`)."""
    return length_status("prose", intended_length, current_words)


def length_status(story_format: str, intended_length: str, current: int) -> dict | None:
    """
    Where a story stands against its intended length, in its format's unit: words for prose,
    pages for a script. None if the form is unbounded or not one the format has.
    """
    fmt = story_format if story_format in LENGTH_TARGETS else "prose"
    ranges = LENGTH_TARGETS[fmt].get(intended_length)
    if not ranges or ranges["max"] is None:
        return None

    top = ranges["max"]
    soft_warning = ranges["soft_warning_at"]
    pct = round(current / top * 100, 1) if top else 0

    if current >= top:
        warning_level = "exceeded"
    elif soft_warning and current >= soft_warning:
        warning_level = "approaching"
    else:
        warning_level = "normal"

    return {
        "min": ranges["min"],
        "max": top,
        "soft_warning_at": soft_warning,
        "current": current,
        "pct": pct,
        "warning_level": warning_level,
        "unit": UNITS[fmt],
    }


def story_pages(story, db) -> int:
    """A script's pages as its PDF prints them: the shared paginator over its scenes in
    reading order, title page aside (doc 25, D5)."""
    from .manuscript_builder import get_manuscript_sections
    from .script_export import pages_in

    return pages_in([s.content for s in get_manuscript_sections(story, db) if s.is_leaf])


def story_target(story, db, words: int) -> dict | None:
    """`length_status` for a story: a script in the pages it prints, prose in `words`."""
    from .story_format import is_script

    if is_script(story):
        return length_status("screenplay", story.intended_length or "", story_pages(story, db))
    return length_status("prose", story.intended_length or "", words)


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
