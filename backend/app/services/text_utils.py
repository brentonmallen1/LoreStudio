"""
Shared HTML → plain text utilities.

TipTap stores scene content as HTML. These helpers extract readable text
for analysis, NLP, and export without any external dependencies.
"""

from __future__ import annotations

from html.parser import HTMLParser


_BLOCK_TAGS = {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"}


class _TextExtractor(HTMLParser):
    """Extract plain text from TipTap HTML, preserving paragraph boundaries."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._paragraphs: list[str] = []
        self._current: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _BLOCK_TAGS and self._current:
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        if tag in _BLOCK_TAGS:
            self._flush()

    def handle_data(self, data: str) -> None:
        self._current.append(data)

    def _flush(self) -> None:
        text = "".join(self._current).strip()
        if text:
            self._paragraphs.append(text)
        self._current = []

    def get_paragraphs(self) -> list[str]:
        self._flush()
        return self._paragraphs


def html_to_text(html: str) -> str:
    """Convert TipTap HTML to a single plain-text string."""
    extractor = _TextExtractor()
    extractor.feed(html)
    return " ".join(extractor.get_paragraphs())


def html_to_paragraphs(html: str) -> list[str]:
    """Convert TipTap HTML to a list of paragraph strings (whitespace-trimmed)."""
    extractor = _TextExtractor()
    extractor.feed(html)
    return extractor.get_paragraphs()
