"""
A screenplay's elements, as both sides read them (doc 25).

A script scene is a run of blocks, each one element: a scene heading, action, a character
cue, a parenthetical, dialogue or a transition. The editor stores the element on the
paragraph (`<p data-el="cue">`); this module says what each element is, how typed or pasted
Fountain-style text is sorted into elements, what Enter and Tab move to, and how the blocks
lay out on a page. The editor's twin is frontend/src/lib/script/syntax.ts, and
shared/script-syntax/cases.json is run by both, so the page count the editor shows is the
one the PDF prints.

The page layout (doc 25, "Export layout spec") is Courier 12pt: ten characters to the inch,
six lines to the inch, 55 lines to a Letter page under a one-inch top margin.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field

from .prose_html import paragraphs
from .prose_syntax import reader_text

ELEMENTS = ("heading", "action", "cue", "paren", "dialogue", "transition", "centered", "lyric")

#: What a cue's speech is made of (doc 25, P8: a sung line belongs to its singer).
SPEECH = ("paren", "dialogue", "lyric")

#: Elements whose text is written in capitals (typed so, not styled so).
CAPITALS = ("heading", "cue", "transition")

#: Where Enter goes from each element (Final Draft's defaults).
ENTER_NEXT = {
    "heading": "action",
    "action": "action",
    "cue": "dialogue",
    "paren": "dialogue",
    "dialogue": "action",
    "transition": "heading",
    "centered": "action",
    "lyric": "lyric",
}

#: What Tab turns the line into, and Shift-Tab back: extras for Final Draft hands (D2).
TAB_NEXT = {
    "action": "cue",
    "cue": "transition",
    "transition": "heading",
    "heading": "action",
    "dialogue": "paren",
    "paren": "dialogue",
    "centered": "action",
    "lyric": "dialogue",
}
SHIFT_TAB_NEXT = {
    "action": "heading",
    "heading": "transition",
    "transition": "cue",
    "cue": "action",
    "dialogue": "cue",
    "paren": "dialogue",
    "centered": "action",
    "lyric": "dialogue",
}

#: Each element's place on the page: its left edge in characters from the 1.5in margin, how
#: many characters wide it runs, and how many blank lines go before it.
LINES_PER_PAGE = 55
CHARS_PER_INCH = 10
LAYOUT: dict[str, dict[str, int]] = {
    "heading": {"x": 0, "width": 60, "before": 1},
    "action": {"x": 0, "width": 60, "before": 1},
    "cue": {"x": 22, "width": 38, "before": 1},
    "paren": {"x": 16, "width": 19, "before": 0},
    "dialogue": {"x": 10, "width": 35, "before": 0},
    "transition": {"x": 0, "width": 60, "before": 1},
    "centered": {"x": 0, "width": 60, "before": 1},
    "lyric": {"x": 10, "width": 35, "before": 0},
}
#: Two speeches at once (doc 25, P8) sit side by side, each in a column 29 characters wide:
#: where each element of a speech goes within its column, and how wide it runs.
DUAL_COLUMN = 29
DUAL_RIGHT = 31
DUAL_LAYOUT: dict[str, dict[str, int]] = {
    "cue": {"x": 9, "width": 20},
    "paren": {"x": 4, "width": 19},
    "dialogue": {"x": 1, "width": 27},
    "lyric": {"x": 1, "width": 27},
}
#: The fewest lines of action or dialogue left on either side of a page break.
MIN_SPLIT = 2

_HEADING = re.compile(r"^(?:INT\.?/EXT|EXT\.?/INT|INT|EXT|EST|I/E)[.\s]", re.I)
_FORCED_HEADING = re.compile(r"^\.(?=[A-Za-z0-9])")
_EXTENSION = re.compile(r"\s*\(([^()]*)\)")
_SENTENCE_END = re.compile(r"[.?!…—\-]['\"’”)]*$")


def is_capitals(text: str) -> bool:
    """Written in capitals: it has letters, and none of them is lower case."""
    return any(ch.isalpha() for ch in text) and text == text.upper()


@dataclass(frozen=True)
class Cue:
    """A character cue: who speaks, and the extensions after the name ("V.O.", "CONT'D")."""

    name: str
    extensions: tuple[str, ...] = ()
    #: Fountain's "^": spoken at the same time as the speech before it.
    dual: bool = False


def parse_cue(text: str) -> Cue:
    t = text.strip()
    dual = t.endswith("^")
    if dual:
        t = t[:-1].rstrip()
    if t.startswith("@"):
        t = t[1:]
    extensions = tuple(m.group(1).strip() for m in _EXTENSION.finditer(t))
    name = _EXTENSION.sub("", t).strip()
    return Cue(name=name, extensions=extensions, dual=dual)


_TITLED = re.compile(r"^(the|mr|mrs|ms|miss|dr|doctor|captain|sir|lady|lord|father|mother|aunt|uncle)\b", re.I)


def cue_name(name: str) -> str:
    """The cue a script writes for a character: what people call them, in capitals. A full name
    is cued by its first name ("Eleanor Vance" is ELEANOR); "The Visitor (Calder)" and a name
    with a title keep their words (THE VISITOR, DR. PRIYA SHARMA); another name the author
    typed ("Nell") is used as written. The editor's `cueName` is the same rule."""
    plain = " ".join(re.sub(r"\s*\([^()]*\)", "", name).split())
    words = plain.split(" ")
    return (words[0] if len(words) > 1 and not _TITLED.match(plain) else plain).upper()


def looks_like_cue(text: str) -> bool:
    """A name in capitals, perhaps with extensions: "ELEANOR", "MRS. HALE (O.S.)".

    "BOOM!" or "SILENCE." is action said loudly, so a cue has no closing punctuation
    outside its parentheses; and it is short.
    """
    t = text.strip()
    if not t or len(t) > 38 or t.startswith("!"):
        return False
    if t.startswith("@"):
        return len(t) > 1
    name = parse_cue(t).name
    if not name or not is_capitals(name) or _HEADING.match(t + " "):
        return False
    return not re.search(r"[.!?:;,]$", name) or name.endswith(("MR.", "MRS.", "MS.", "DR.", "ST."))


def classify_line(text: str, prev: str | None) -> str:
    """The element a typed or pasted line is, given the element before it (None at the top).

    Fountain's forcing marks win: "." a heading, "!" action, "@" a cue, ">" a transition.
    """
    t = text.strip()
    if not t:
        return "action"
    if _FORCED_HEADING.match(t) or _HEADING.match(t + " "):
        return "heading"
    if t.startswith("!"):
        return "action"
    if t.startswith(">") and t.endswith("<") and len(t) > 2:
        return "centered"
    if t.startswith(">"):
        return "transition"
    if t.startswith("~"):
        return "lyric"
    if prev in ("cue", *SPEECH) and t.startswith("(") and t.endswith(")"):
        return "paren"
    if prev in ("cue", *SPEECH):
        return "dialogue"
    if is_capitals(t) and t.endswith("TO:"):
        return "transition"
    if t.startswith("@") or looks_like_cue(t):
        return "cue"
    return "action"


def clean(element: str, text: str) -> str:
    """A line's text as stored: forcing marks off, capitals where the element takes them."""
    t = text.strip()
    if element == "heading" and _FORCED_HEADING.match(t):
        t = t[1:]
    elif element == "action" and t.startswith("!"):
        t = t[1:]
    elif element == "cue" and t.startswith("@"):
        return t[1:]  # Fountain's "@" keeps a name's own capitals: McCLANE
    elif element == "transition" and t.startswith(">"):
        t = t[1:].strip()
    elif element == "centered" and t.startswith(">") and t.endswith("<"):
        t = t[1:-1].strip()
    elif element == "lyric" and t.startswith("~"):
        t = t[1:].strip()
    return t.upper() if element in CAPITALS else t


def parse_lines(text: str) -> list[tuple[str, str]]:
    """Fountain-style text, pasted or imported, as (element, text) blocks.

    A cue needs a blank line before it and a line after it; the lines after a cue are its
    speech until a blank line; lines of action with no blank between them stay one block,
    their breaks kept as "\\n".
    """
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[tuple[str, str]] = []
    prev: str | None = None
    blank_before = True
    for i, raw in enumerate(lines):
        line = raw.rstrip()
        if not line.strip():
            if prev in ("cue", *SPEECH):
                prev = "action"
            blank_before = True
            continue
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        el = classify_line(line, prev if not blank_before else None)
        if el == "cue" and not line.strip().startswith("@") and (not blank_before or not nxt):
            el = "action"
        if el == "heading" and not blank_before and not _FORCED_HEADING.match(line.strip()):
            el = "action"
        if blocks and not blank_before and el == blocks[-1][0] in ("action", "dialogue", "lyric"):
            blocks[-1] = (el, blocks[-1][1] + "\n" + clean(el, line))
        else:
            blocks.append((el, clean(el, line)))
        prev = el
        blank_before = False
    return blocks


#: How a heading says where the camera is, as stored ("INT/EXT"), and as printed ("INT./EXT.").
INTERIORS = {"INT": "INT.", "EXT": "EXT.", "INT/EXT": "INT./EXT.", "EXT/INT": "EXT./INT.", "EST": "EST."}
_SLUG_PREFIX = re.compile(r"^(INT\.?/EXT|EXT\.?/INT|I/E|INT|EXT|EST)\.?\s+", re.I)
#: A scene number written after a heading, "#12#".
SCENE_NUMBER = re.compile(r"\s*#[^#]*#\s*$")


@dataclass(frozen=True)
class Slug:
    """A scene heading read: "INT. KEEPER'S COTTAGE - NIGHT" is INT, KEEPER'S COTTAGE, NIGHT."""

    interior: str = ""
    place: str = ""
    time: str = ""


def parse_slugline(text: str) -> Slug:
    """A heading's parts. The time is what follows the last " - "; what is between is the place."""
    t = SCENE_NUMBER.sub("", text.strip())
    if _FORCED_HEADING.match(t):
        t = t[1:]
    interior = ""
    m = _SLUG_PREFIX.match(t)
    if m:
        word = m.group(1).upper().replace(".", "")
        interior = "INT/EXT" if word == "I/E" else word
        t = t[m.end() :]
    place, sep, time = t.rpartition(" - ")
    if not sep:
        place, time = t, ""
    return Slug(interior, place.strip(), time.strip())


def format_slugline(slug: Slug) -> str:
    """A heading from its parts, the way it prints."""
    head = " ".join(p for p in (INTERIORS.get(slug.interior, slug.interior), slug.place.upper()) if p)
    return f"{head} - {slug.time.upper()}" if slug.time else head


_OPENING = re.compile(r"^FADE IN\W*$", re.I)


def heading_at(blocks: Sequence[tuple[str | None, str]]) -> int:
    """Where a scene's own heading is, among its (element, text) blocks: its first line, or the
    first after the lines that open a script ("FADE IN:", a transition). A heading further down
    starts another scene."""
    i = 0
    while i < len(blocks) and (blocks[i][0] == "transition" or _OPENING.match(blocks[i][1].strip())):
        i += 1
    return i


def scene_blocks(html: str) -> list[tuple[str, str]]:
    """A stored script scene as (element, text) blocks, read as the page shows it (mentions
    as their names). A paragraph with no element, from prose, is action."""
    out: list[tuple[str, str]] = []
    for para in paragraphs(html):
        element = para.element if para.element in ELEMENTS else "action"
        text = reader_text(para.text)
        out.append((element, f"{text} ^" if element == "cue" and para.dual else text))
    return out


# ── The page ─────────────────────────────────────────────────────────────────────────────


def wrap(text: str, width: int, *, hang: int = 0) -> list[str]:
    """Greedy word wrap; a line break in the text always breaks. Every line after the first is
    `hang` narrower (a parenthetical's lines sit inside its opening bracket)."""
    out: list[str] = []

    def limit() -> int:
        return width - (hang if out else 0)

    for part in text.split("\n"):
        line = ""
        for word in part.split():
            if line and len(line) + 1 + len(word) <= limit():
                line += " " + word
                continue
            if line:
                out.append(line)
                line = ""
            while len(word) > limit():
                cut = limit()
                out.append(word[:cut])
                word = word[cut:]
            line = word
        out.append(line)
    return out


@dataclass
class Line:
    element: str
    text: str
    #: Left edge, in characters from the 1.5in margin.
    x: int


@dataclass
class Page:
    #: Lines from the top; None is a blank line.
    lines: list[Line | None] = field(default_factory=list)
    #: The right-hand speech of dual dialogue, by row: the line beside `lines[row]`.
    beside: dict[int, Line] = field(default_factory=dict)

    @property
    def used(self) -> int:
        return len(self.lines)


def block_lines(element: str, text: str) -> list[Line]:
    """One block's lines on the page, wrapped and placed."""
    spec = LAYOUT.get(element, LAYOUT["action"])
    hang = 1 if element == "paren" else 0
    lines: list[Line] = []
    for i, t in enumerate(wrap(text, spec["width"], hang=hang)):
        if element == "transition":
            x = max(0, spec["width"] - len(t))
        elif element == "centered":
            x = max(0, (spec["width"] - len(t)) // 2)
        else:
            x = spec["x"] + (hang if i else 0)
        lines.append(Line(element, t, x))
    return lines


def shown_cue(text: str) -> str:
    """A cue as it prints: Fountain's dual mark off."""
    return re.sub(r"\s*\^$", "", text.strip())


def _column(blocks: list[tuple[str, str]], origin: int) -> list[Line]:
    """One speech of dual dialogue, laid out in its column."""
    out: list[Line] = []
    for element, text in blocks:
        spec = DUAL_LAYOUT.get(element, DUAL_LAYOUT["dialogue"])
        hang = 1 if element == "paren" else 0
        body = shown_cue(text) if element == "cue" else text
        for i, t in enumerate(wrap(body, spec["width"], hang=hang)):
            out.append(Line(element, t, origin + spec["x"] + (hang if i else 0)))
    return out


def _speech_end(blocks: list[tuple[str, str]], i: int) -> int:
    """The end (exclusive) of the speech starting at a cue: its parentheticals and dialogue."""
    j = i + 1
    while j < len(blocks) and blocks[j][0] in SPEECH:
        j += 1
    return j


class _Layout:
    def __init__(self, lines_per_page: int):
        self.size = lines_per_page
        self.pages = [Page()]

    @property
    def page(self) -> Page:
        return self.pages[-1]

    def gap(self, element: str) -> int:
        return LAYOUT.get(element, LAYOUT["action"])["before"] if self.page.used else 0

    def room(self, element: str) -> int:
        return self.size - self.page.used - self.gap(element)

    def put(self, element: str, lines: list[Line]) -> None:
        self.page.lines.extend([None] * self.gap(element))
        self.page.lines.extend(lines)

    def turn(self) -> None:
        if self.page.used:
            self.pages.append(Page())

    def lines(self, element: str, lines: list[Line], keep: int = 0) -> None:
        """Lines of one block; `keep` more lines of what follows must fit under them."""
        if len(lines) + keep <= self.room(element):
            self.put(element, lines)
            return
        splits = element == "action"
        while splits and len(lines) >= 2 * MIN_SPLIT and self.room(element) >= MIN_SPLIT:
            take = min(self.room(element), len(lines) - MIN_SPLIT)
            self.put(element, lines[:take])
            self.turn()
            lines = lines[take:]
            if len(lines) + keep <= self.room(element):
                self.put(element, lines)
                return
        self.turn()
        self.put(element, lines)

    def speech(self, cue_text: str, body: list[Line]) -> None:
        """A cue and its speech. It splits only in the dialogue, after a sentence, two lines on
        each side: "(MORE)" closes the page, "NAME (CONT'D)" opens the next."""
        cue_text = shown_cue(cue_text)
        head = block_lines("cue", cue_text)
        while True:
            room = self.room("cue")
            if len(head) + len(body) <= room:
                self.put("cue", head + body)
                return
            split = _speech_split(body, room - len(head) - 1)
            if split is None:
                if self.page.used:
                    self.turn()
                    continue
                split = max(1, room - len(head) - 1)  # a speech longer than a page: cut anywhere
            self.put("cue", head + body[:split] + [Line("more", "(MORE)", LAYOUT["cue"]["x"])])
            self.turn()
            cue = parse_cue(cue_text)
            kept = "".join(f" ({e})" for e in cue.extensions if e.upper() != "CONT'D")
            cue_text = f"{cue.name}{kept} (CONT'D)"
            head = block_lines("cue", cue_text)
            body = body[split:]


def _dual(layout: _Layout, left: list[Line], right: list[Line]) -> None:
    """Two speeches at once, side by side. They are never split: if both do not fit, they
    start the next page together."""
    if max(len(left), len(right)) > layout.room("cue"):
        layout.turn()
    layout.page.lines.extend([None] * layout.gap("cue"))
    top = layout.page.used
    layout.page.lines.extend(left + [None] * (len(right) - len(left)))
    for row, line in enumerate(right):
        layout.page.beside[top + row] = line


def _speech_split(body: list[Line], most: int) -> int | None:
    """Where a speech can break: after a dialogue line that ends a sentence, with at least two
    lines of dialogue on each side and nothing but dialogue or a parenthetical after it."""
    for k in range(min(most, len(body) - MIN_SPLIT), MIN_SPLIT - 1, -1):
        last, after = body[k - 1], body[k]
        if last.element != "dialogue" or after.element not in ("dialogue", "paren"):
            continue
        if not _SENTENCE_END.search(last.text):
            continue
        if sum(1 for ln in body[:k] if ln.element == "dialogue") >= MIN_SPLIT and (
            sum(1 for ln in body[k:] if ln.element == "dialogue") >= MIN_SPLIT
        ):
            return k
    return None


def _keep_with(blocks: list[tuple[str, str]], i: int) -> int:
    """How many lines of what follows a heading must go with it: two lines, or a cue and two."""
    if i + 1 >= len(blocks):
        return 0
    element, text = blocks[i + 1]
    before = LAYOUT.get(element, LAYOUT["action"])["before"]
    if element == "cue":
        end = _speech_end(blocks, i + 1)
        body = sum(len(block_lines(e, t)) for e, t in blocks[i + 2 : end])
        return before + 1 + min(body, MIN_SPLIT)
    return before + min(len(block_lines(element, text)), MIN_SPLIT)


def paginate(blocks: list[tuple[str, str]], lines_per_page: int = LINES_PER_PAGE) -> list[Page]:
    """Lay the blocks out on pages, the way the PDF prints them.

    Blank lines before a block are dropped at the top of a page. A heading never ends a page:
    it goes over with the first lines after it. Action splits between lines with at least two
    on each side. A speech splits as `_Layout.speech` says. Otherwise a block that does not fit
    starts the next page.
    """
    layout = _Layout(lines_per_page)
    blocks = [(e, t) for e, t in blocks if t.strip()]
    i = 0
    while i < len(blocks):
        element, text = blocks[i]
        if element == "cue":
            end = _speech_end(blocks, i)
            if end < len(blocks) and blocks[end][0] == "cue" and parse_cue(blocks[end][1]).dual:
                after = _speech_end(blocks, end)
                _dual(layout, _column(blocks[i:end], 0), _column(blocks[end:after], DUAL_RIGHT))
                i = after
                continue
            body = [ln for e, t in blocks[i + 1 : end] for ln in block_lines(e, t)]
            layout.speech(text, body)
            i = end
            continue
        keep = _keep_with(blocks, i) if element == "heading" else 0
        layout.lines(element, block_lines(element, text), keep)
        i += 1
    return layout.pages


def page_count(blocks: list[tuple[str, str]]) -> int:
    """How many pages the blocks print on (none for nothing)."""
    if not any(text.strip() for _, text in blocks):
        return 0
    return len(paginate(blocks))


def scene_lines(blocks: list[tuple[str, str]]) -> int:
    """How many lines the blocks take laid end to end, blank lines included: a scene's length,
    shown in eighths of a page (LINES_PER_PAGE / 8 lines each)."""
    blocks = [(e, t) for e, t in blocks if t.strip()]
    total = i = 0
    while i < len(blocks):
        element, text = blocks[i]
        gap = LAYOUT.get(element, LAYOUT["action"])["before"] if total else 0
        end = _speech_end(blocks, i) if element == "cue" else i + 1
        if element == "cue" and end < len(blocks) and blocks[end][0] == "cue" and parse_cue(blocks[end][1]).dual:
            after = _speech_end(blocks, end)
            total += gap + max(len(_column(blocks[i:end], 0)), len(_column(blocks[end:after], DUAL_RIGHT)))
            i = after
            continue
        total += gap + len(block_lines(element, text))
        i += 1
    return total


def eighths(lines: int) -> int:
    """A scene's length in eighths of a page, never less than one for a scene with words."""
    if lines <= 0:
        return 0
    return max(1, round(lines * 8 / LINES_PER_PAGE))
