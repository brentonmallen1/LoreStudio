"""
Entity refactoring service.

Handles rename propagation: when a character or location is renamed, finds every @mention,
[[reference]] and (for a character) "…"<Name> speaker tag in the scenes and updates the
name inside it. Found and rewritten by the grammar on the text (services/prose_rewrite), so
the preview counts exactly what the rename changes: a mention ending a paragraph, one
followed by ’s or a dash, a name with an ampersand.
"""

from collections import defaultdict
from collections.abc import Callable
from typing import Literal

from sqlalchemy.orm import Session

from ..models.scene_take import SceneTake
from ..models.structure import StructureNode
from ..schemas.refactoring import RenamePreviewItem
from . import takes
from .prose_rewrite import name_occurrences, rename
from .word_count import count_words


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
    """Scan all scenes for uses of old_name, return a preview. A scene's other takes (doc 29 D7)
    are read too: a rename reaches them, and a take still saying the old name keeps it an alias."""
    in_takes: dict[str, list] = defaultdict(list)
    for take in takes.others(db, story_id):
        in_takes[take.node_id] += name_occurrences(take.content or "", entity_type, old_name)
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    results: list[RenamePreviewItem] = []
    for node in nodes:
        uses = name_occurrences(node.content or "", entity_type, old_name)
        elsewhere = in_takes.get(node.id, [])
        if uses or elsewhere:
            results.append(
                RenamePreviewItem(
                    node_id=node.id,
                    node_title=node.title or "(Untitled)",
                    occurrences=len(uses) + len(elsewhere),
                    in_other_takes=len(elsewhere),
                    excerpt=_excerpt((uses or elsewhere)[0][1], old_name),
                )
            )
    return results


def apply_entity_rename(
    entity_type: Literal["character", "location"],
    old_name: str,
    new_name: str,
    node_ids: list[str],
    db: Session,
    write: Callable[[StructureNode | SceneTake, str], None] | None = None,
) -> list[StructureNode]:
    """Apply rename to selected scenes and their other takes. Returns the updated nodes.

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
    # The scenes' other takes (doc 29 D7), in the same change.
    for take in takes.others(db, nodes[0].story_id, node_ids) if nodes else []:
        content, changed = rename(take.content or "", entity_type, old_name, new_name)
        if changed:
            if write:
                write(take, content)
            else:
                take.content, take.word_count = content, count_words(content)
    db.flush()
    return updated
