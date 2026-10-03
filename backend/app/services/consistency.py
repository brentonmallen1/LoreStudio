"""Deterministic character-consistency checks over the manuscript. No model involved.

Findings are hints ("check this"), never corrections. Each carries the node it
was found in and an excerpt so the editor can jump to it. The findings feed
(`services/findings/local.py`) runs these on every read; point of view is checked
by the editorial-consistency pass instead.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.structure import StructureNode
from .text_utils import html_to_text

_WORD = re.compile(r"\b[A-Z][a-z]{3,}\b")

#: Capitalised everyday words that are near many names; never flagged.
_COMMON = {
    "There",
    "Then",
    "That",
    "This",
    "They",
    "Them",
    "When",
    "What",
    "Where",
    "With",
    "Will",
    "Just",
    "Like",
    "Even",
    "Only",
    "Once",
    "Over",
    "Into",
    "From",
    "Some",
    "Most",
    "Much",
    "More",
    "Been",
    "Have",
    "Come",
    "Came",
    "Said",
    "Tell",
    "Told",
    "Take",
    "Took",
    "Look",
    "Well",
    "Here",
    "Your",
    "Their",
    "About",
    "After",
    "Before",
    "Still",
    "Never",
    "Maybe",
    "Every",
    "Other",
    "Which",
    "While",
    "Would",
    "Could",
    "Should",
    "Right",
    "Night",
    "Light",
    "Water",
    "House",
    "Chapter",
    "Scene",
}


@dataclass
class Finding:
    kind: str  # name_drift | unknown_speaker | pov_drift
    node_id: str
    node_title: str
    text: str
    suggestion: str
    excerpt: str
    severity: str = "info"  # info | warn


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 2:
        return 3
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _excerpt(text: str, word: str, width: int = 60) -> str:
    i = text.find(word)
    if i < 0:
        return ""
    start = max(0, i - width // 2)
    end = min(len(text), i + len(word) + width // 2)
    return ("…" if start else "") + text[start:end].replace("\n", " ") + ("…" if end < len(text) else "")


def name_drift(nodes: list[StructureNode], characters: list[Character]) -> list[Finding]:
    """Capitalised words one or two edits away from a character's name (or a name part)."""
    names: set[str] = set()
    for c in characters:
        # Words only: splitting on spaces kept "(Calder)" from "The Visitor (Calder)", and
        # every "Calder" in the prose was two edits from it — flagged as a misspelling.
        # Other names too: "Nell" is a name, not a misspelling of one.
        for part in re.findall(r"[^\W\d_][\w'’]*", " ".join([c.name or "", *(getattr(c, "aliases", None) or [])])):
            if len(part) >= 4:
                names.add(part)
    if not names:
        return []
    lower_names = {n.lower() for n in names}
    findings: list[Finding] = []
    for node in nodes:
        text = html_to_text(node.content or "")
        seen: set[str] = set()
        for m in _WORD.finditer(text):
            word = m.group(0)
            if word in seen or word in _COMMON or word in names or word.lower() in lower_names:
                continue
            seen.add(word)
            for name in names:
                d = levenshtein(word.lower(), name.lower())
                if 0 < d <= (1 if len(name) <= 5 else 2):
                    findings.append(
                        Finding(
                            kind="name_drift",
                            node_id=node.id,
                            node_title=node.title,
                            text=word,
                            suggestion=name,
                            excerpt=_excerpt(text, word),
                            severity="warn",
                        )
                    )
                    break
    return findings


def unknown_speakers(nodes: list[StructureNode], characters: list[Character], db: Session) -> list[Finding]:
    """Dialogue attributed to a speaker that is not a character in the Lorebook."""
    known = {(c.name or "").lower() for c in characters}
    node_by_id = {n.id: n for n in nodes}
    if not node_by_id:
        return []
    blocks = db.query(DialogueBlock).filter(DialogueBlock.scene_id.in_(list(node_by_id))).all()
    findings: list[Finding] = []
    seen: set[tuple[str, str]] = set()
    for b in blocks:
        speaker = (b.speaker_name or "").strip()
        if not speaker or speaker.lower() in known or b.character_id:
            continue
        key = (b.scene_id, speaker.lower())
        if key in seen:
            continue
        seen.add(key)
        node = node_by_id[b.scene_id]
        findings.append(
            Finding(
                kind="unknown_speaker",
                node_id=node.id,
                node_title=node.title,
                text=speaker,
                suggestion="Add this character to the Lorebook or fix the speaker tag",
                excerpt=(b.content or "")[:80],
            )
        )
    return findings
