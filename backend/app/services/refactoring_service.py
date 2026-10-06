"""
Entity refactoring service.

Handles rename propagation: when a character or location is renamed, finds every @mention,
[[reference]] and (for a character) "…"<Name> speaker tag in the scenes and updates the
name inside it. Found and rewritten by the grammar on the text (services/prose_rewrite), so
the preview counts exactly what the rename changes: a mention ending a paragraph, one
followed by ’s or a dash, a name with an ampersand.
"""

from collections.abc import Callable
from typing import Literal

from sqlalchemy.orm import Session

from ..models.structure import StructureNode
from ..schemas.refactoring import RenamePreviewItem
from .prose_rewrite import name_occurrences, rename


def _excerpt(text: str, name: str) -> str:
    """A short context string around the first use of the name in a paragraph."""
    at = text.casefold().find(name.casefold())
    at = max(at, 0)
    start = max(0, at - 40)
    end = min(len(text), at + len(name) + 60)
    excerpt = text[start:end].strip()
    return ("…" if start > 0 else "") + excerpt + ("…" if end < len(text) else "")


def preview_entity_rename(
    entity_type: Literal["character", "location"],
    old_name: str,
    new_name: str,
    story_id: str,
    db: Session,
) -> list[RenamePreviewItem]:
    """Scan all scenes for uses of old_name, return a preview."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id, StructureNode.content != "").all()
    results: list[RenamePreviewItem] = []
    for node in nodes:
        uses = name_occurrences(node.content or "", entity_type, old_name)
        if uses:
            results.append(
                RenamePreviewItem(
                    node_id=node.id,
                    node_title=node.title or "(Untitled)",
                    occurrences=len(uses),
                    excerpt=_excerpt(uses[0][1], old_name),
                )
            )
    return results


def apply_entity_rename(
    entity_type: Literal["character", "location"],
    old_name: str,
    new_name: str,
    node_ids: list[str],
    db: Session,
    write: Callable[[StructureNode, str], None] | None = None,
) -> list[StructureNode]:
    """Apply rename to selected scenes. Returns updated nodes.

    ``write`` sets a scene's new content in place of a bare assignment: the route passes
    ``change_log.prose_writer`` so the rename is recorded and undoes with the name.
    """
    nodes = db.query(StructureNode).filter(StructureNode.id.in_(node_ids)).all()
    updated: list[StructureNode] = []
    for node in nodes:
        content, changed = rename(node.content or "", entity_type, old_name, new_name)
        if changed:
            if write:
                write(node, content)
            else:
                node.content = content
            node.summary_stale = True
            updated.append(node)
    db.flush()
    return updated
