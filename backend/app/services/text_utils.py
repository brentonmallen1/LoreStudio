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


def last_paragraphs(html: str, count: int = 2, max_chars: int = 700) -> list[str]:
    """The closing paragraphs of a scene, for the Overview's "where you left off" card.

    Keeps the last ``count`` paragraphs; when they run past ``max_chars`` the first is cut
    from the front at a word and opens with an ellipsis, so the lines nearest the end of
    the scene, where the writer stopped, are always whole.
    """
    paras = html_to_paragraphs(html)[-count:]
    over = sum(len(p) for p in paras) - max_chars
    if over > 0 and len(paras) > 1:
        head = paras[0][over:]
        cut = head.find(" ")
        head = head[cut + 1 :] if cut >= 0 else ""
        paras = ([f"… {head}"] if head else []) + paras[1:]
    return paras


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


# ── Quote normalisation ──────────────────────────────────────────────────────
#
# Straight and curly quotes mixed in one manuscript is the most common copy-edit
# note. Conversion works on text nodes only (never on markup) and decides
# opening vs closing from the character before the quote.

_OPENERS_BEFORE = set(" \t\n\r(—–-[{“‘/")


def _curly_double(text: str) -> str:
    out = []
    for i, ch in enumerate(text):
        if ch != '"':
            out.append(ch)
            continue
        prev = text[i - 1] if i > 0 else " "
        out.append("“" if prev in _OPENERS_BEFORE else "”")
    return "".join(out)


def _curly_single(text: str) -> str:
    out = []
    for i, ch in enumerate(text):
        if ch != "'":
            out.append(ch)
            continue
        prev = text[i - 1] if i > 0 else " "
        nxt = text[i + 1] if i + 1 < len(text) else " "
        if prev.isalnum() or (prev in _OPENERS_BEFORE and not nxt.isalnum() and nxt not in _OPENERS_BEFORE):
            out.append("’")  # apostrophe / closing
        elif prev in _OPENERS_BEFORE:
            out.append("‘")
        else:
            out.append("’")
    return "".join(out)


def normalize_quotes_text(text: str, style: str) -> str:
    if style == "straight":
        return text.translate(str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'"}))
    return _curly_single(_curly_double(text))


def count_quote_styles(html: str) -> dict[str, int]:
    text = html_to_text(html)
    return {
        "straight": text.count('"') + text.count("'"),
        "curly": sum(text.count(c) for c in "“”‘’"),
    }


def normalize_quotes_html(html: str, style: str) -> tuple[str, int]:
    """Convert quotes in the prose of an HTML fragment. Returns (html, changed_chars)."""
    from bs4 import BeautifulSoup, NavigableString

    soup = BeautifulSoup(html, "html.parser")
    changed = 0
    for node in list(soup.find_all(string=True)):
        if not isinstance(node, NavigableString) or node.parent is None or node.parent.name in ("script", "style"):
            continue
        before = str(node)
        after = normalize_quotes_text(before, style)
        if after != before:
            changed += sum(1 for a, b in zip(before, after) if a != b)
            node.replace_with(after)
    return (str(soup) if changed else html), changed
