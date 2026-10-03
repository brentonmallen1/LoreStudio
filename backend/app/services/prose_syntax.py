"""
The prose's inline syntax, defined once (doc 16, D2).

    @Name               a character        @Eleanor Vance, @Tom, @O'Brien
    [[Place]]           a place            [[Keeper's Cottage]]
    "spoken"<Name>      who says the line  "I know."<Calder>, “I know.” <Calder>, ‘No.’<Maya>

All of it reads plain text (a paragraph, decoded: `text_utils.html_to_paragraphs`), never HTML.
The editor has the same rules in `frontend/src/lib/prose/syntax.ts`, and both run every case
in `shared/prose-syntax/cases.json`, so the two sides cannot drift apart again.

The rules are lenient where a writer cannot see the difference: any capitals, straight or
curly apostrophes and quotes, a space before `<Name>`, `'s` after a mention. And strict where
prose is not syntax: `me@host.com` is an address, `x < 5` is arithmetic.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

Kind = Literal["character", "place"]

_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'"})
_SPACE = re.compile(r"\s+")


def fold(name: str) -> str:
    """A name as compared: any case, any apostrophe, single spaces."""
    return _SPACE.sub(" ", name.translate(_APOSTROPHES)).strip().casefold()


def is_word(ch: str) -> bool:
    return ch == "_" or ch.isalnum() or unicodedata.category(ch).startswith("M")


@dataclass(frozen=True)
class Known:
    kind: Kind
    name: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class Mention:
    kind: Kind
    start: int
    end: int
    #: The words inside the syntax, as written ("Tom", "the keeper’s cottage").
    written: str
    #: The entry they name (its own name), or None when they name nobody.
    name: str | None


class Lexicon:
    """The names a story's prose may use, each folded, longest first."""

    def __init__(self, known: list[Known]):
        self.by_kind: dict[str, dict[str, str]] = {"character": {}, "place": {}}
        for k in known:
            for n in (k.name, *k.aliases):
                if n and n.strip():
                    self.by_kind[k.kind].setdefault(fold(n), k.name)
        self.characters = sorted(self.by_kind["character"], key=len, reverse=True)


def _unknown_word(text: str, i: int) -> int:
    """End of a one-word name starting at i: letters and digits, inner ' or - kept, a
    trailing possessive ('s) and trailing punctuation left out."""
    n = len(text)
    j = i
    while j < n:
        if is_word(text[j]):
            j += 1
        elif text[j] in "'’-" and j + 1 < n and is_word(text[j + 1]):
            j += 1
        else:
            break
    if j - i > 2 and text[j - 2] in "'’" and text[j - 1] in "sS":
        j -= 2
    return j


def _known_at(text: str, i: int, lex: Lexicon) -> tuple[int, str] | None:
    """The longest known character name at i, ending at a word boundary."""
    for key in lex.characters:
        end = i + len(key)
        if end > len(text) or fold(text[i:end]) != key:
            continue
        if end < len(text) and is_word(text[end]):
            continue
        return end, lex.by_kind["character"][key]
    return None


_PLACE = re.compile(r"\[\[([^\[\]\n￼]+)\]\]")


def find_mentions(text: str, lex: Lexicon) -> list[Mention]:
    out: list[Mention] = []
    i = 0
    while (i := text.find("@", i)) != -1:
        at, i = i, i + 1
        if at > 0 and is_word(text[at - 1]):
            continue  # an address: me@host.com
        if i >= len(text) or not text[i].isalpha():
            continue
        if found := _known_at(text, i, lex):
            end, name = found
        else:
            end, name = _unknown_word(text, i), None
        out.append(Mention("character", at, end, text[i:end], name))
        i = end
    for m in _PLACE.finditer(text):
        written = m.group(1).strip()
        if written:
            out.append(Mention("place", m.start(), m.end(), written, lex.by_kind["place"].get(fold(written))))
    return sorted(out, key=lambda m: m.start)


@dataclass(frozen=True)
class SpeakerTag:
    #: The quoted line, its quote marks included.
    quote_start: int
    quote_end: int
    #: The tag, from its "<" (or the space before it) to its ">".
    tag_start: int
    end: int
    speaker: str

    @property
    def start(self) -> int:
        return self.quote_start


_TAG = re.compile(r"([\"”'’])[ \t ]?<([^<>\n]{1,80})>")
_DOUBLE_OPEN = '"“'
_SINGLE_BOUNDARY = ' \t\n([—–“" '


def _opening(text: str, close: int) -> int | None:
    """Where the quote that `close` ends begins."""
    if text[close] in '"”':
        j = max(text.rfind(c, 0, close) for c in _DOUBLE_OPEN)
        return j if j >= 0 else None
    # A single quote: a ‘, or a ' that starts a word (not the one in "don't").
    j = close - 1
    while j >= 0:
        ch = text[j]
        if ch == "‘" or (ch == "'" and (j == 0 or text[j - 1] in _SINGLE_BOUNDARY)):
            return j
        if ch in '"”“':
            return None
        j -= 1
    return None


def find_speaker_tags(text: str) -> list[SpeakerTag]:
    out: list[SpeakerTag] = []
    for m in _TAG.finditer(text):
        speaker = m.group(2).strip()
        open_at = _opening(text, m.start(1))
        if not speaker or open_at is None or m.start(1) - open_at < 2:
            continue
        out.append(SpeakerTag(open_at, m.start(1) + 1, m.start(1) + 1, m.end(), speaker))
    return out


def reader_text(text: str) -> str:
    """The prose as a reader sees it: no `@`, no `[[ ]]`, no `<Name>` after a line."""
    cuts: list[tuple[int, int, str]] = [(t.tag_start, t.end, "") for t in find_speaker_tags(text)]
    for m in find_mentions(text, Lexicon([])):
        if m.kind == "character":
            cuts.append((m.start, m.start + 1, ""))
        else:
            cuts.append((m.start, m.end, m.written))
    out, last = [], 0
    for start, end, keep in sorted(cuts):
        if start < last:
            continue
        out.append(text[last:start] + keep)
        last = end
    out.append(text[last:])
    return "".join(out)
