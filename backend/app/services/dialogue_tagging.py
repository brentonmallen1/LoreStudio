"""Which lines of dialogue the tagger offers to attribute (doc 13 P4, doc 14 Q6).

The tagger offers every spoken line the prose does not tag outright, each with the reader's
own guess: the same speech tags, action beats and alternation that Numbers and the
Dialogue view use, so a suggestion here is what the rest of the app already believes.
Tagging one makes it the author's.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel

from ..models.character import Character
from ..models.story import Story
from ..models.structure import StructureNode
from .dialogue_service import _html_to_paragraphs, plan_scene


class ProposedDialogueTag(BaseModel):
    id: str
    quote_content: str
    inferred_speaker: str | None
    character_id: str | None
    confidence: float
    source_excerpt: str


def _excerpt(para: str, start: int, length: int) -> str:
    a, b = max(0, start - 25), min(len(para), start + length + 30)
    return ("…" if a > 0 else "") + para[a:b] + ("…" if b < len(para) else "")


def suggest_tags(scene: StructureNode, story: Story | None, characters: list[Character]) -> list[ProposedDialogueTag]:
    """Every untagged spoken line in the scene, with the reader's best guess at its speaker."""
    paragraphs = _html_to_paragraphs(scene.content or "")
    out: list[ProposedDialogueTag] = []
    for line in plan_scene(scene, story, characters):
        if line.get("dialogue_type") == "thought" or line["attribution_method"] == "explicit":
            continue
        idx = line["paragraph_index"]
        para = paragraphs[idx] if 0 <= idx < len(paragraphs) else ""
        out.append(
            ProposedDialogueTag(
                id=str(uuid.uuid4()),
                quote_content=line["content"],
                inferred_speaker=line["speaker_name"] or None,
                character_id=line.get("character_id"),
                confidence=line["confidence"],
                source_excerpt=_excerpt(para, line["position_in_paragraph"], len(line["content"])),
            )
        )
    return out
