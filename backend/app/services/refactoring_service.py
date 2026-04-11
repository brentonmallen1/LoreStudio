"""
Entity refactoring service.

Handles rename propagation: when a character or location is renamed, finds all
@mentions and [[references]] in scene content and updates them.
"""

import re
import uuid
from typing import Literal

from sqlalchemy.orm import Session

from ..models.structure import StructureNode
from ..schemas.refactoring import RenamePreviewItem
from .text_utils import html_to_text as _html_to_text


def _mention_pattern(entity_type: Literal["character", "location"], name: str) -> str:
    escaped = re.escape(name)
    if entity_type == "character":
        return rf'@{escaped}(?=[\s.,;:!?)"\'\\]]|$)'
    else:
        return rf'\[\[{escaped}\]\]'


def _attribution_pattern(name: str) -> str:
    """Dialogue attribution pattern: "..."<Name>"""
    escaped = re.escape(name)
    return rf'(<){escaped}(>)'


def _count_occurrences(entity_type: Literal["character", "location"], name: str, content: str) -> int:
    text = _html_to_text(content)
    pattern = _mention_pattern(entity_type, name)
    count = len(re.findall(pattern, text))
    if entity_type == "character":
        count += len(re.findall(_attribution_pattern(name), text))
    return count


def _extract_excerpt(entity_type: Literal["character", "location"], name: str, content: str) -> str:
    """Return a short context string around the first occurrence."""
    text = _html_to_text(content)
    pattern = _mention_pattern(entity_type, name)
    m = re.search(pattern, text)
    if not m:
        if entity_type == "character":
            m = re.search(_attribution_pattern(name), text)
    if not m:
        return ""
    start = max(0, m.start() - 40)
    end = min(len(text), m.end() + 60)
    excerpt = text[start:end].strip()
    if start > 0:
        excerpt = "…" + excerpt
    if end < len(text):
        excerpt = excerpt + "…"
    return excerpt


def preview_entity_rename(
    entity_type: Literal["character", "location"],
    old_name: str,
    new_name: str,
    story_id: str,
    db: Session,
) -> list[RenamePreviewItem]:
    """Scan all scenes for occurrences of old_name mentions, return preview."""
    nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story_id, StructureNode.content != "")
        .all()
    )
    results: list[RenamePreviewItem] = []
    for node in nodes:
        if not node.content:
            continue
        count = _count_occurrences(entity_type, old_name, node.content)
        if count > 0:
            results.append(RenamePreviewItem(
                node_id=node.id,
                node_title=node.title or "(Untitled)",
                occurrences=count,
                excerpt=_extract_excerpt(entity_type, old_name, node.content),
            ))
    return results


def apply_entity_rename(
    entity_type: Literal["character", "location"],
    old_name: str,
    new_name: str,
    node_ids: list[str],
    db: Session,
) -> list[StructureNode]:
    """Apply rename to selected scenes. Returns updated nodes."""
    nodes = db.query(StructureNode).filter(StructureNode.id.in_(node_ids)).all()
    updated: list[StructureNode] = []
    pattern = _mention_pattern(entity_type, old_name)

    for node in nodes:
        if not node.content:
            continue
        new_content = node.content

        if entity_type == "character":
            # Replace @OldName mentions
            new_content = re.sub(pattern, f"@{new_name}", new_content)
            # Replace dialogue attribution <OldName> → <NewName>
            attr_pattern = _attribution_pattern(old_name)
            new_content = re.sub(attr_pattern, rf'\g<1>{re.escape(new_name)}\g<2>', new_content)
        else:
            # Replace [[OldName]] → [[NewName]]
            new_content = re.sub(pattern, f"[[{new_name}]]", new_content)

        if new_content != node.content:
            node.content = new_content
            node.summary_stale = True
            updated.append(node)

    db.flush()
    return updated
