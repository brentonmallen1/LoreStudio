"""
Fountain, the plain-text screenplay format (https://fountain.io), written out (doc 25, P3).

Each block is written plainly and gets a forcing mark only where a Fountain reader would take
it for something else: "." on a heading that does not start INT./EXT., "!" on action that looks
like a cue or a heading, "@" on a cue not in capitals, ">" on a transition not ending "TO:".
`script_syntax.parse_lines` (the paste reader, and P6's import) reads it back to the same blocks.
"""

from __future__ import annotations

import re

from .script_export import ScriptDoc, ScriptOptions
from .script_syntax import classify_line, looks_like_cue

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
