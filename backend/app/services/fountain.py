"""
Fountain, the plain-text screenplay format (https://fountain.io), written out (doc 25, P3).

Each block is written plainly and gets a forcing mark only where a Fountain reader would take
it for something else: "." on a heading that does not start INT./EXT., "!" on action that looks
like a cue or a heading, "@" on a cue not in capitals, ">" on a transition not ending "TO:".
`script_syntax.parse_lines` (the paste reader) reads it back to the same blocks.

`parse` reads a whole file for import (doc 25, P6): the title page, "#" sections, "="
synopses and "[[notes]]" around those blocks; the boneyard ("/* */") is left out.
"""

from __future__ import annotations

import re

from .script_export import ScriptDoc, ScriptOptions
from .script_source import SceneNote, ScriptSource, Section, Synopsis
from .script_syntax import SCENE_NUMBER, classify_line, looks_like_cue, parse_lines

#: Fountain's own marks at the start of a line: a section, a synopsis, a lyric, a note, the boneyard.
_MARK_START = ("#", "=", "~", "[[", "/*")
_EMPHASIS = re.compile(r"([*_\\])")


def _escape(text: str) -> str:
    """Asterisks and underscores are emphasis in Fountain; the author's own are kept literal."""
    return _EMPHASIS.sub(r"\\\1", text)


def _action(text: str) -> list[str]:
    out = []
    for i, line in enumerate(text.split("\n")):
        prev = None if i == 0 else "action"
        forced = classify_line(line, prev) != "action" or line.lstrip().startswith(_MARK_START)
        out.append(("!" if forced else "") + _escape(line))
    return out


def _block(element: str, text: str, number: int | None, options: ScriptOptions, speech_follows: bool) -> list[str]:
    t = _escape(text)
    if element == "heading":
        mark = "" if classify_line(text, None) == "heading" else "."
        return [f"{mark}{t}" + (f" #{number}#" if options.scene_numbers and number else "")]
    if element == "cue":
        plain = looks_like_cue(text) and speech_follows
        return [t if plain else f"@{t}"]
    if element == "transition":
        return [t if classify_line(text, None) == "transition" else f"> {t}"]
    if element in ("paren", "dialogue"):
        return t.split("\n")
    return _action(text)


def _title_page(doc: ScriptDoc) -> list[str]:
    page = doc.page
    pairs = [("Title", doc.title), ("Credit", page.credit if doc.author else ""), ("Author", doc.author)]
    pairs += [("Source", page.based_on), ("Draft date", ", ".join(t for t in (page.draft, page.date) if t.strip()))]
    pairs += [("Contact", page.contact)]
    out = []
    for key, value in pairs:
        lines = [v.strip() for v in value.strip().split("\n") if v.strip()]
        if len(lines) == 1:
            out.append(f"{key}: {lines[0]}")
        elif lines:
            out.append(f"{key}:")
            out += [f"   {v}" for v in lines]
    return out


def to_fountain(doc: ScriptDoc, options: ScriptOptions) -> str:
    out: list[str] = []
    if options.title_page:
        out += _title_page(doc)
    blocks = doc.blocks
    for i, block in enumerate(blocks):
        if block.element not in ("paren", "dialogue") and out:
            out.append("")
        follows = i + 1 < len(blocks) and blocks[i + 1].element in ("paren", "dialogue")
        out += _block(block.element, block.text, block.number, options, follows)
    return "\n".join(out).strip() + "\n"


# ── Reading a file (doc 25, P6) ──────────────────────────────────────────────────────────

_BONEYARD = re.compile(r"/\*.*?\*/", re.S)
_NOTE = re.compile(r"\[\[(.*?)\]\]", re.S)
#: Stand-ins while a line is read: an escaped "*" or "_", and a note by its number.
_STAR, _UNDER = "\ue000", "\ue001"
_NOTE_AT = re.compile("\\s?\ue002(\\d+)\ue003")
_EMPHASIS_RUN = re.compile(r"(\*{1,3})(?=\S)(.+?)(?<=\S)\1|_(?=\S)(.+?)(?<=\S)_")
_UNDERLINE = re.compile(r"_(?=\S)(.+?)(?<=\S)_")
_STYLES = {1: "em", 2: "strong", 3: "em strong"}
_TITLE_KEY = re.compile(r"^([A-Za-z][A-Za-z ]*?):\s*(.*)$")
_TITLE_KEYS = {"title", "credit", "author", "authors", "source", "draft date", "date", "contact", "revision", "notes"}


def _literal(text: str) -> str:
    return text.replace(_STAR, "*").replace(_UNDER, "_")


def _runs(text: str) -> list[tuple[str, str]]:
    """A block's words as runs of (words, style): *italic*, **bold**, ***both***. Underline
    (_words_) has no mark in the editor, so its words come in plain."""
    out: list[tuple[str, str]] = []
    pos = 0
    for m in _EMPHASIS_RUN.finditer(text):
        out.append((text[pos : m.start()], ""))
        if m.group(1):
            out.append((_UNDERLINE.sub(r"\1", m.group(2)), _STYLES[len(m.group(1))]))
        else:
            out.append((m.group(3), ""))
        pos = m.end()
    out.append((text[pos:], ""))
    return [(_literal(t), style) for t, style in out if t]


def _plain(text: str) -> str:
    """A title page value as words: no emphasis marks, no notes."""
    return _literal("".join(t for t, _ in _runs(_NOTE_AT.sub("", text)))).strip()


def _read_title_page(lines: list[str], src: ScriptSource) -> int:
    """Read the title page, if the file opens on one; the line its script starts on."""
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    first = _TITLE_KEY.match(lines[i]) if i < len(lines) else None
    if not first or first.group(1).strip().lower() not in _TITLE_KEYS:
        return 0
    fields: dict[str, list[str]] = {}
    key = ""
    while i < len(lines) and lines[i].strip():
        m = _TITLE_KEY.match(lines[i])
        if m and not lines[i][:1].isspace():
            key = m.group(1).strip().lower()
            fields.setdefault(key, [])
            if m.group(2).strip():
                fields[key].append(_plain(m.group(2)))
        elif key:
            fields[key].append(_plain(lines[i]))
        i += 1

    def value(*keys: str, sep: str = "\n") -> str:
        return sep.join(v for k in keys for v in fields.get(k, []) if v)

    src.title = value("title", sep=" ")
    src.author = value("author", "authors", sep=" & ")
    page = {
        "credit": value("credit", sep=" "),
        "based_on": value("source"),
        "contact": value("contact"),
        "draft": value("revision", sep=" "),
        "date": value("draft date", "date", sep=" "),
    }
    src.page = {k: v for k, v in page.items() if v}
    return i


def _read_chunk(chunk: list[str], notes: list[str], src: ScriptSource) -> None:
    """Lines between Fountain's own marks: blocks, each with the notes written on its lines."""
    on_line: list[list[str]] = []
    plain: list[str] = []
    for line in chunk:
        rest = _NOTE_AT.sub("", line)
        if rest.strip():
            on_line.append([notes[int(n)] for n in _NOTE_AT.findall(line)])
        plain.append(rest.rstrip())
    for element, text in parse_lines("\n".join(plain)):
        k = text.count("\n") + 1
        mine = [n for line_notes in on_line[:k] for n in line_notes]
        on_line = on_line[k:]
        if element == "cue":
            text = text.removesuffix("^").rstrip()  # dual dialogue: P8
        elif element == "heading":
            text = SCENE_NUMBER.sub("", text)  # the export numbers scenes itself
        src.block(element, _runs(text), mine)


def parse(text: str) -> ScriptSource:
    """A Fountain file, read (doc 25, P6)."""
    src = ScriptSource()
    text = _BONEYARD.sub("", text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n"))
    text = text.replace("\\*", _STAR).replace("\\_", _UNDER)
    notes: list[str] = []

    def keep(m: re.Match) -> str:
        notes.append(" ".join(m.group(1).split()))
        return f"\ue002{len(notes) - 1}\ue003"

    lines = _NOTE.sub(keep, text).split("\n")
    chunk: list[str] = []
    for line in lines[_read_title_page(lines, src) :]:
        s = line.strip()
        lone = bool(s) and not _NOTE_AT.sub("", s).strip()
        if not (s.startswith(("#", "=")) or lone):
            chunk.append(line)
            continue
        _read_chunk(chunk, notes, src)
        chunk = []
        if lone:
            src.items.extend(SceneNote(notes[int(n)]) for n in _NOTE_AT.findall(s))
        elif s.startswith("#"):
            depth = len(s) - len(s.lstrip("#"))
            src.items.append(Section(depth, _plain(s[depth:])))
        elif not re.fullmatch(r"={3,}", s):  # "===" is a page break, which the layout makes
            src.items.append(Synopsis(_plain(s[1:])))
    _read_chunk(chunk, notes, src)
    return src
