"""
Reading order: where a node sits in the book, depth first.

Sorting on a node's own `position` interleaves branches (scene 1 of every chapter, then scene 2
of every chapter). Everything that lists scenes, events or clues "in order" reads it from here.
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from ..models.structure import StructureNode


def order_of(nodes: Iterable[StructureNode]) -> dict[str, int]:
    children: dict[str | None, list[StructureNode]] = {}
    for n in nodes:
        children.setdefault(n.parent_id, []).append(n)
    order: dict[str, int] = {}

    def walk(parent: str | None) -> None:
        for n in sorted(children.get(parent, []), key=lambda n: n.position):
            order[n.id] = len(order)
            walk(n.id)

    walk(None)
    return order


def reading_order(story_id: str, db: Session) -> dict[str, int]:
    """Each node's place in the book, depth first."""
    return order_of(db.query(StructureNode).filter(StructureNode.story_id == story_id).all())
