"""
A scene's first line (doc 29 D6): what the Outline shows for a scene that has words but no line
of what happens yet, marked "from the first line" until the writer writes one.

Read with the shared prose helpers (`prose_html.paragraphs`, `prose_syntax.reader_text`), so the
line reads as a reader sees it: no tags, no `@`, no `[[ ]]`, no `<Name>` after a line. A heading
(a prose `<h2>`, a script's scene heading) is skipped: the first line is the first line of story.
"""

from __future__ import annotations

import re

from .prose_html import paragraphs
from .prose_syntax import reader_text

#: Only the start of a scene is read: the first sentence is in it, and a long scene costs nothing.
HEAD_CHARS = 4000
#: Longer than this, the sentence is cut at a word and ends in "…".
MAX_CHARS = 160

_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
#: The end of a sentence: . ! ? or … with any closing quotes or brackets, then a space or the end.
_END = re.compile(r"[.!?…][\"'”’)\]]*(?=\s|$)")
#: Short forms that end in a full stop without ending the sentence ("Dr. Ames").
_TITLES = {"mr", "mrs", "ms", "dr", "st", "mt", "prof", "rev", "capt", "col", "gen", "lt", "sgt"}


def first_sentence(text: str) -> str:
    """The first sentence of a paragraph's text, or the start of it when it runs long."""
    text = " ".join(text.split())
    for m in _END.finditer(text):
        word = text[: m.start()].rsplit(" ", 1)[-1].lower()
        if text[m.start()] == "." and word in _TITLES:
            continue
        text = text[: m.end()]
        break
    if len(text) <= MAX_CHARS:
        return text
    cut = text[:MAX_CHARS].rsplit(" ", 1)[0].rstrip(" ,;:—–-")
    return f"{cut}…"


def first_line(html: str | None) -> str:
    """The scene's first sentence as a reader meets it, or "" when it has no words."""
    head = html or ""
    if len(head) > HEAD_CHARS:
        head = head[: head.rfind(">", 0, HEAD_CHARS) + 1]
    for para in paragraphs(head):
        if para.tag in _HEADINGS or para.element == "heading":
            continue
        text = reader_text(para.text).strip()
        if text:
            return first_sentence(text)
    return ""
