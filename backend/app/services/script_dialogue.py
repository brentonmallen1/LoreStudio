"""
Who speaks in a screenplay (doc 25, P4): read from the cues, not from quote marks.

Prose marks speech with quotes and a tag ("…"<Eleanor>); a script marks it with a cue. Each
dialogue block under a cue is one line, spoken by the cue's character, with the parenthetical
before it as its direction and V.O. or O.S. as how it is heard. The rows are the same
DialogueBlock rows prose makes, so voices, presence, the Dialogue tool and the numbers all
work for a script unchanged; `dialogue_service._reconcile` keeps a line's subtext and a hand
correction as it does for prose.
"""

from __future__ import annotations

from collections.abc import Callable

from ..models.character import Character
from .script_syntax import parse_cue, scene_blocks

#: How a line is heard, from the cue's extensions.
_HEARD = {"V.O.": "voice_over", "VO": "voice_over", "O.S.": "off_screen", "O.C.": "off_screen", "OS": "off_screen"}


def heard_as(extensions: tuple[str, ...]) -> str:
    """How a line is heard: speech, or voice_over / off_screen when the cue says V.O. or O.S.
    (anything but "thought" is speech to every count)."""
    for ext in extensions:
        if kind := _HEARD.get(ext.upper().replace(" ", "")):
            return kind
    return "speech"


def person(cue: str) -> str:
    """A cue's name as a name: THE STRANGER is The Stranger, O'BRIEN is O'Brien."""
    return cue.title()


def plan_script(content: str, resolve: Callable[[str], Character | None]) -> list[dict]:
    """Every line of dialogue in a script scene, attributed by its cue, in reading order."""
    lines: list[dict] = []
    cue = None
    direction = ""
    for i, (element, text) in enumerate(scene_blocks(content)):
        if element == "cue":
            cue = parse_cue(text)
            direction = ""
        elif element == "paren" and cue:
            direction = text.strip().removeprefix("(").removesuffix(")").strip()
        elif element == "dialogue" and cue and text.strip():
            char = resolve(cue.name)
            lines.append(
                {
                    "content": text.strip(),
                    "raw_text": text.strip(),
                    "paragraph_index": i,
                    "position_in_paragraph": 0,
                    "attribution_method": "cue",
                    "confidence": 1.0,
                    "speaker_name": char.name if char else person(cue.name),
                    "character_id": char.id if char else None,
                    "dialogue_type": heard_as(cue.extensions),
                    "direction": direction,
                }
            )
            direction = ""
        elif element not in ("paren", "dialogue"):
            cue = None
    return lines
