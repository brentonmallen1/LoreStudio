"""
Partial updates that can clear a field (doc 18, B1).

`model_dump(exclude_none=True)` treats "set this to null" as "leave it alone", so clearing a
twist's reveal scene or a thread's opening scene silently did nothing. A PATCH applies the
fields the client sent; null clears a field that may be null and is ignored for one that may not.
Scene references are checked against the story: a scene from another story is a 422, not a
dangling id.
"""

from __future__ import annotations

from collections.abc import Iterable

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.structure import StructureNode


def patch_fields(body: BaseModel, nullable: Iterable[str]) -> dict:
    """The fields the client sent; None only where the column may be null."""
    allowed = set(nullable)
    return {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k in allowed}


def check_nodes(db: Session, story_id: str, data: dict, keys: Iterable[str]) -> None:
    """Every scene id among `keys` in `data` belongs to the story."""
    for key in keys:
        node_id = data.get(key)
        if node_id is None:
            continue
        node = db.get(StructureNode, node_id)
        if node is None or node.story_id != story_id:
            raise HTTPException(status_code=422, detail=f"{key}: no such scene in this story")
