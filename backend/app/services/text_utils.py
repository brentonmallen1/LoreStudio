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


class _EmExtractor(HTMLParser):
    """Extract <em>…</em> text spans with their paragraph index."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._para_index: int = -1
        self._in_em: bool = False
        self._em_buf: list[str] = []
        self._results: list[tuple[int, int, str]] = []  # (para_index, char_offset, text)
        self._para_char_offset: int = 0
        self._current_para_len: int = 0
        self._em_start_offset: int = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _BLOCK_TAGS:
            self._para_index += 1
            self._current_para_len = 0
        elif tag == "em":
            self._in_em = True
            self._em_buf = []
            self._em_start_offset = self._current_para_len

    def handle_endtag(self, tag: str) -> None:
        if tag == "em" and self._in_em:
            self._in_em = False
            text = "".join(self._em_buf).strip()
            if text and len(text.split()) >= 2:
                self._results.append((max(self._para_index, 0), self._em_start_offset, text))
            self._current_para_len += len("".join(self._em_buf))

    def handle_data(self, data: str) -> None:
        if self._in_em:
            self._em_buf.append(data)
        else:
            self._current_para_len += len(data)

    def get_results(self) -> list[tuple[int, int, str]]:
        return self._results


def extract_em_blocks(html: str) -> list[tuple[int, int, str]]:
    """Return (para_index, char_offset, text) for italicized spans of ≥2 words.

    Used to detect inner monologue in first-person prose.
    """
    extractor = _EmExtractor()
    extractor.feed(html)
    return extractor.get_results()
