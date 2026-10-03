"""
Prose HTML read as text and edited as text (doc 16, D4).

Every rewrite of the prose (tagging a line, renaming someone, linking a mention, fixing a
name, replacing words, curling quotes) used to run a regex over the stored HTML, which
broke on anything between the words: `<em>` in a quote, `&amp;` in a name, a note's span,
`&lt;Name&gt;` where `<Name>` was meant. Here a paragraph is read the way a reader sees it,
each character remembering where it sits in the HTML, so a rewrite finds its words with the
grammar (`prose_syntax`) and edits exactly those characters, leaving the markup alone.
"""

from __future__ import annotations

import html as _html
import re
from dataclasses import dataclass, field

_TOKEN = re.compile(r"<!--.*?-->|<[^>]*>|&(?:#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);|[^<&]+|&", re.S)
_TAG_NAME = re.compile(r"<\s*/?\s*([A-Za-z][A-Za-z0-9]*)")
_BLOCKS = {"p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "hr"}


@dataclass
class Paragraph:
    """One block's text, and for each character its [start, end) in the HTML."""

    text: str = ""
    spans: list[tuple[int, int]] = field(default_factory=list)

    def html_range(self, start: int, end: int) -> tuple[int, int]:
        """The HTML holding text[start:end]; an empty range is the point after text[start-1]."""
        if end > start:
            return self.spans[start][0], self.spans[end - 1][1]
        if start == 0:
            return self.spans[0][0], self.spans[0][0]
        at = self.spans[start - 1][1]
        return at, at


def paragraphs(html: str) -> list[Paragraph]:
    """The prose's paragraphs, as text, in order. A line break reads as "\\n"."""
    out: list[Paragraph] = []
    cur = Paragraph()

    def flush():
        nonlocal cur
        if cur.text.strip():
            out.append(cur)
        cur = Paragraph()

    for m in _TOKEN.finditer(html or ""):
        tok = m.group(0)
        if tok.startswith("<"):
            name = _TAG_NAME.match(tok)
            tag = name.group(1).lower() if name else ""
            if tag in _BLOCKS:
                flush()
            elif tag == "br":
                cur.text += "\n"
                cur.spans.append((m.start(), m.end()))
            continue
        chars = _html.unescape(tok) if tok.startswith("&") else tok
        if tok.startswith("&"):
            for ch in chars:
                cur.text += ch
                cur.spans.append((m.start(), m.end()))
        else:
            for i, ch in enumerate(chars):
                cur.text += ch
                cur.spans.append((m.start() + i, m.start() + i + 1))
    flush()
    return out


@dataclass
class Edit:
    para: Paragraph
    start: int
    end: int
    #: Plain text: it is escaped on the way in.
    text: str


def apply_edits(html: str, edits: list[Edit]) -> tuple[str, int]:
    """
    Apply text edits to the HTML they were read from. An edit whose words run across markup
    (half in italics, say) is skipped, since replacing them would break the tags; so is one
    that overlaps an edit before it. Returns (html, applied).
    """
    placed: list[tuple[int, int, str]] = []
    for e in edits:
        a, b = e.para.html_range(e.start, e.end)
        if "<" in html[a:b]:
            continue
        if any(a < y and x < b for x, y, _ in placed) or any(a == b == x == y for x, y, _ in placed):
            continue
        placed.append((a, b, _html.escape(e.text, quote=False)))
    for a, b, new in sorted(placed, key=lambda p: (p[0], p[1]), reverse=True):
        html = html[:a] + new + html[b:]
    return html, len(placed)
