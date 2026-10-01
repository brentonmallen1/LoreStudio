"""Which lines of dialogue the tagger offers to attribute (doc 13 P4).

One detector for the tagger and for the Proposals inbox, so "3 lines with no speaker" in the
inbox is the 3 lines the tagger opens on. A paragraph that already has a ``<Name>`` tag is
the author's, and is left alone.
"""

from __future__ import annotations

import re
import uuid

from pydantic import BaseModel

from ..models.structure import StructureNode
from .dialogue_service import _MENTION_RE, _STANDALONE_QUOTE_RE, _html_to_paragraphs


class ProposedDialogueTag(BaseModel):
    id: str
    quote_content: str
    inferred_speaker: str | None
    character_id: str | None
    confidence: float
    source_excerpt: str


def suggest_tags(scene: StructureNode, char_by_name: dict) -> list[ProposedDialogueTag]:
    """Every quote in the scene the tagger would offer to attribute, with its best guess."""

    paragraphs = _html_to_paragraphs(scene.content or "")
    proposals: list[ProposedDialogueTag] = []
    for para in paragraphs:
        if re.search(r'"[^"]+?"<[^>]+>', para) or re.search(r"\u201d<[^>]+>", para):
            continue

        mentions = [(m.start(), m.group(1).strip()) for m in _MENTION_RE.finditer(para)]
        for m in _STANDALONE_QUOTE_RE.finditer(para):
            content = (m.group(1) or m.group(2) or "").strip()
            if not content or len(content) < 2:
                continue

            q_pos = m.start()
            best_speaker: str | None = None
            best_dist = 999

            for m_pos, m_name in mentions:
                dist = abs(q_pos - m_pos)
                if dist < best_dist and dist <= 150:
                    best_dist = dist
                    best_speaker = m_name

            confidence = round(max(0.0, 1.0 - (best_dist / 150)), 2) if best_speaker else 0.0

            excerpt_start = max(0, q_pos - 25)
            excerpt_end = min(len(para), q_pos + len(content) + 30)
            excerpt = para[excerpt_start:excerpt_end]
            if excerpt_start > 0:
                excerpt = "…" + excerpt
            if excerpt_end < len(para):
                excerpt = excerpt + "…"

            char = char_by_name.get(best_speaker.lower()) if best_speaker else None

            proposals.append(
                ProposedDialogueTag(
                    id=str(uuid.uuid4()),
                    quote_content=content,
                    inferred_speaker=best_speaker,
                    character_id=char.id if char else None,
                    confidence=confidence,
                    source_excerpt=excerpt,
                )
            )

    return proposals
