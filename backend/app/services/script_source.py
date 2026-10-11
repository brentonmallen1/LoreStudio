"""
A script file read for import (doc 25, P6): what a Fountain or Final Draft file says, in one
shape whichever it came from. `fountain.parse` and `fdx.parse` write it; services/import_script
turns it into a screenplay story.

The text of each block is kept as the editor stores it: escaped, with the author's italics and
bold, and a margin note's words wrapped in the note's anchor.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from html import escape


@dataclass
class Section:
    """An act or a sequence: Fountain's "#" (depth 1) and "##" (depth 2), Final Draft's New Act."""

    depth: int
    title: str


@dataclass
class Block:
    element: str
    #: Inner HTML, as stored.
    html: str
    #: The plain words, for previews and counts.
    text: str
    #: A cue spoken at the same time as the speech before it (Fountain's "^", doc 25 P8).
    dual: bool = False


@dataclass
class Synopsis:
    """What a scene is about, in the author's words: the scene it is in takes it."""

    text: str


@dataclass
class SceneNote:
    """A note on its own line: the scene it is in keeps it, tied to no passage."""

    text: str


Item = Section | Block | Synopsis | SceneNote


@dataclass
class ScriptSource:
    title: str = ""
    author: str = ""
    #: The title page's other lines, as services/script_export.TitlePage keeps them.
    page: dict[str, str] = field(default_factory=dict)
    items: list[Item] = field(default_factory=list)
    #: Margin notes by id, as (the note, the words it sits beside); the anchor is in a block's HTML.
    notes: dict[str, tuple[str, str]] = field(default_factory=dict)

    def block(self, element: str, runs: list[tuple[str, str]], notes: list[str], dual: bool = False) -> Block:
        """A block from runs of (words, "em" | "strong" | "em strong" | ""), its first note
        anchored on its words (a second note on one line is kept as the scene's)."""
        inner = "".join(_marked(text, style) for text, style in runs)
        text = "".join(t for t, _ in runs)
        if notes and text.strip():
            note_id = str(uuid.uuid4())
            self.notes[note_id] = (notes[0], text)
            inner = f'<span data-note-id="{note_id}" class="note-anchor">{inner}</span>'
            notes = notes[1:]
        out = Block(element, inner, text, dual)
        self.items.append(out)
        self.items.extend(SceneNote(n) for n in notes)
        return out


def _marked(text: str, style: str) -> str:
    out = escape(text, quote=False).replace("\n", "<br>")
    if "strong" in style:
        out = f"<strong>{out}</strong>"
    if "em" in style:
        out = f"<em>{out}</em>"
    return out
