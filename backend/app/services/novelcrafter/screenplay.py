"""A manuscript written as a script in a word processor, typed back into script elements.

Novelcrafter's docx flattens a script to plain paragraphs: ``INT. LOCAL TAVERN - NIGHT``,
``NEWCOMB (looking up from his desk) Richard, I hate to say this…``, ``CUT TO:``. When the
author imports it as a screenplay (doc 28, opt-in), each paragraph becomes the elements it is:
a heading, a transition, a cue with its parenthetical and speech, or action. Nothing is
reworded; a cue run together with its speech is only split where the capitals end.
"""

from __future__ import annotations

import re
from html import escape

from ...schemas.import_schemas import ParsedParagraph
from ..text_utils import html_to_text

_HEADING = re.compile(r"^(INT|EXT|EST|INT\.?/EXT|I/E)[.\s]", re.IGNORECASE)
_TRANSITION = re.compile(
    r"^(FADE (IN|OUT)|CUT TO|SMASH CUT( TO)?|MATCH CUT( TO)?|DISSOLVE TO|FADE TO BLACK)[:.]?$", re.IGNORECASE
)
#: A cue, then perhaps a parenthetical, then the speech: the name is capitals only.
_CUE = re.compile(r"^(?P<name>[A-Z][A-Z0-9 .'\-]{1,30}?)(?:\s*(?P<paren>\([^)]*\)))?\s+(?P<speech>\S.*)$")
_NOT_NAMES = {"INT", "EXT", "CUT", "FADE", "THE", "A", "I"}

#: How many script lines make a manuscript worth offering as a screenplay.
SCRIPT_LINES = 3


def _cue(text: str) -> tuple[str, str, str] | None:
    m = _CUE.match(text)
    if not m:
        return None
    name = m.group("name").strip()
    speech = m.group("speech")
    # A cue's name is in capitals; the speech has lowercase in it, or it is a heading.
    if name.split()[0].rstrip(".") in _NOT_NAMES or not re.search(r"[a-z]", speech):
        return None
    return name, m.group("paren") or "", speech


def blocks(text: str) -> list[tuple[str, str]]:
    """One paragraph's text as (element, text) pairs, in the script elements' names."""
    t = " ".join(text.split())  # pandoc wraps a long line; the element is the whole of it
    if not t:
        return []
    if _HEADING.match(t):
        return [("heading", t.upper())]
    if _TRANSITION.match(t) or (t.isupper() and t.endswith("TO:")):
        return [("transition", t.upper())]
    cue = _cue(t)
    if cue:
        name, paren, speech = cue
        return [("cue", name), *([("paren", paren)] if paren else []), ("dialogue", speech)]
    return [("action", t)]


def looks_like_screenplay(paragraphs: list[ParsedParagraph]) -> bool:
    lines = 0
    for p in paragraphs:
        if p.tag != "p":
            continue
        kinds = {k for k, _ in blocks(html_to_text(p.html))}
        lines += bool(kinds & {"heading", "transition", "cue"})
        if lines >= SCRIPT_LINES:
            return True
    return False


def as_script(paragraphs: list[ParsedParagraph]) -> tuple[list[ParsedParagraph], list[str]]:
    """The paragraphs with each body paragraph's html typed as script elements, and each
    paragraph's first element (as ``import_script.ScriptImport.elements`` holds them)."""
    out: list[ParsedParagraph] = []
    elements: list[str] = []
    for p in paragraphs:
        if p.tag != "p":
            out.append(p)
            elements.append("section" if p.tag.startswith("h") else "action")
            continue
        found = blocks(html_to_text(p.html))
        if not found:
            out.append(p)
            elements.append("action")
            continue
        html = "".join(f'<p data-el="{el}">{escape(text)}</p>' for el, text in found)
        out.append(p.model_copy(update={"html": html}))
        elements.append(found[0][0])
    return out, elements
