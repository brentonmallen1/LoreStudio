"""
Every rewrite of the prose, on the text and by the grammar (doc 16, D4).

Each reads the scene with `prose_html.paragraphs`, finds its words with `prose_syntax`, and
edits only those characters, so markup between words (italics, a note, `&amp;`) neither hides
a match nor gets cut through, and the syntax around words (a speaker tag, a mention's `@`,
a place's `[[ ]]`) is only ever changed on purpose.
"""

from __future__ import annotations

from typing import Literal

from .prose_html import Edit, apply_edits, paragraphs
from .prose_syntax import Known, Lexicon, find_mentions, find_quotes, find_speaker_tags, fold, is_word

_NO_NAMES = Lexicon([])


def _syntax_ranges(text: str) -> list[tuple[int, int]]:
    """The stretches of syntax in a paragraph: never part of a found word."""
    out = [(t.tag_start, t.end) for t in find_speaker_tags(text)]
    for m in find_mentions(text, _NO_NAMES):
        if m.kind == "character":
            out.append((m.start, m.start + 1))
        else:
            out += [(m.start, m.start + 2), (m.end - 2, m.end)]
    return out


def find_in_text(
    text: str, term: str, *, case_sensitive: bool = False, whole_word: bool = False
) -> list[tuple[int, int]]:
    """Where `term` is in a paragraph's text: never in a speaker tag, a mention's `@` or a
    place's brackets (their words still count), never overlapping. The editor's ⌘F has the
    same rule (lib/prose/find.ts); both run shared/prose-syntax/cases.json."""
    if not term:
        return []
    hay = text if case_sensitive else text.lower()
    needle = term if case_sensitive else term.lower()
    syntax = _syntax_ranges(text)
    out: list[tuple[int, int]] = []
    i = hay.find(needle)
    while i != -1:
        end = i + len(needle)
        whole = not whole_word or (
            (i == 0 or not is_word(text[i - 1])) and (end >= len(text) or not is_word(text[end]))
        )
        if whole and not any(i < b and a < end for a, b in syntax):
            out.append((i, end))
            i = hay.find(needle, end)
        else:
            i = hay.find(needle, i + 1)
    return out


def replace_words(
    html: str, query: str, replacement: str, *, case_sensitive: bool = False, whole_word: bool = False
) -> tuple[str, int]:
    """Story-wide replace and the name fix: the words, not the tags around them."""
    edits = [
        Edit(p, a, b, replacement)
        for p in paragraphs(html)
        for a, b in find_in_text(p.text, query, case_sensitive=case_sensitive, whole_word=whole_word)
    ]
    return apply_edits(html, edits) if edits else (html, 0)


def tag_lines(html: str, tags: list[tuple[str, str]]) -> tuple[str, int]:
    """
    Tag them: each (line, speaker) puts `<speaker>` after the first untagged quote that says
    that line, in reading order: once, even when the scene says it twice, and whatever
    markup or quote marks the line has.
    """
    paras = paragraphs(html)
    quotes = [(p, q) for p in paras for q in find_quotes(p.text)]
    taken: set[int] = set()
    edits: list[Edit] = []
    for words, speaker in tags:
        want = fold(words)
        for i, (p, q) in enumerate(quotes):
            if i not in taken and fold(q.words) == want:
                taken.add(i)
                edits.append(Edit(p, q.end, q.end, f"<{speaker.strip()}>"))
                break
    return apply_edits(html, edits) if edits else (html, 0)


Kind = Literal["character", "location"]


def name_occurrences(html: str, kind: Kind, name: str) -> list[tuple[int, str]]:
    """Each place the prose uses `name` as a mention (or, for a character, a speaker tag):
    (paragraph index, the paragraph's text) per use, for a rename's preview."""
    return [(i, p.text) for i, p, _a, _b in _uses(html, kind, name)]


def _uses(html: str, kind: Kind, name: str):
    lex = Lexicon([Known("character" if kind == "character" else "place", name)])
    want = fold(name)
    for i, p in enumerate(paragraphs(html)):
        for m in find_mentions(p.text, lex):
            if fold(m.written) == want:
                inner = p.text.index(m.written, m.start)
                yield i, p, inner, inner + len(m.written)
        if kind == "character":
            for t in find_speaker_tags(p.text):
                if fold(t.speaker) == want:
                    inner = p.text.index(t.speaker, p.text.index("<", t.tag_start))
                    yield i, p, inner, inner + len(t.speaker)


def rename(html: str, kind: Kind, old: str, new: str) -> tuple[str, int]:
    """Rename: the words inside each mention (and a character's speaker tags) that say `old`."""
    edits = [Edit(p, a, b, new) for _i, p, a, b in _uses(html, kind, old)]
    return apply_edits(html, edits) if edits else (html, 0)


_OPENERS_BEFORE = set(" \t\n\r(—–-[{“‘/ ")


def normalize_quotes(html: str, style: str) -> tuple[str, int]:
    """
    Straight or curly quote marks throughout, deciding opening from closing by the character
    before, across italics (a paragraph is read whole). Names are left as they are spelt,
    inside mentions and speaker tags, so "@O'Brien" still finds O'Brien.
    """
    edits: list[Edit] = []
    for p in paragraphs(html):
        text = p.text
        keep = [(t.tag_start, t.end) for t in find_speaker_tags(text)]
        keep += [(m.start, m.end) for m in find_mentions(text, _NO_NAMES)]
        for i, ch in enumerate(text):
            if ch not in "\"'“”‘’" or any(a <= i < b for a, b in keep):
                continue
            new = _straight(ch) if style == "straight" else _curly(text, i)
            if new != ch:
                edits.append(Edit(p, i, i + 1, new))
    return apply_edits(html, edits) if edits else (html, 0)


def _straight(ch: str) -> str:
    return {"“": '"', "”": '"', "‘": "'", "’": "'"}.get(ch, ch)


def _curly(text: str, i: int) -> str:
    ch = text[i]
    prev = text[i - 1] if i > 0 else " "
    if ch in '"“”':
        return "“" if prev in _OPENERS_BEFORE else "”"
    nxt = text[i + 1] if i + 1 < len(text) else " "
    if prev.isalnum() or (prev in _OPENERS_BEFORE and not nxt.isalnum() and nxt not in _OPENERS_BEFORE):
        return "’"  # an apostrophe, or a closing quote
    return "‘" if prev in _OPENERS_BEFORE else "’"
