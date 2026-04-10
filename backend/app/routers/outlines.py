from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.outline import OutlineItem
from ..schemas.outline import OutlineItemCreate, OutlineItemUpdate, OutlineItemOut, ReorderPayload, BulkReorderPayload
from ..auth.dependencies import get_current_user

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_item(item_id: str, db: Session, user: User) -> OutlineItem:
    item = db.get(OutlineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Outline item not found")
    _verify_story(item.story_id, db, user)
    return item


def _build_tree(items: list[OutlineItem]) -> list[OutlineItemOut]:
    """Arrange flat list into a parent→children tree (root items only at top level).

    Converts to Pydantic objects first to avoid triggering SQLAlchemy cascade
    delete-orphan events when manipulating the children collection.
    """
    by_id: dict[str, OutlineItemOut] = {
        item.id: OutlineItemOut.model_validate(item) for item in items
    }
    roots: list[OutlineItemOut] = []
    for node in by_id.values():
        if node.parent_id and node.parent_id in by_id:
            by_id[node.parent_id].children.append(node)
        elif node.parent_id is None:
            roots.append(node)
    roots.sort(key=lambda i: i.position)
    for node in by_id.values():
        node.children.sort(key=lambda i: i.position)
    return roots


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/stories/{story_id}/outline", response_model=list[OutlineItemOut])
def get_outline(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    items = (
        db.query(OutlineItem)
        .filter(OutlineItem.story_id == story_id)
        .order_by(OutlineItem.position.asc())
        .all()
    )
    return _build_tree(items)


@router.post("/stories/{story_id}/outline", response_model=OutlineItemOut, status_code=status.HTTP_201_CREATED)
def create_outline_item(
    story_id: str,
    body: OutlineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)

    # Compute level from parent
    level = 0
    if body.parent_id:
        parent = db.get(OutlineItem, body.parent_id)
        if parent:
            level = parent.level + 1

    # Auto-position at end if not specified
    position = body.position
    if position == 0:
        siblings = (
            db.query(OutlineItem)
            .filter(
                OutlineItem.story_id == story_id,
                OutlineItem.parent_id == body.parent_id,
            )
            .count()
        )
        position = siblings

    item = OutlineItem(
        story_id=story_id,
        level=level,
        position=position,
        text=body.text,
        parent_id=body.parent_id,
        beat_type=body.beat_type,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item.children = []
    return item


@router.patch("/outline/{item_id}", response_model=OutlineItemOut)
def update_outline_item(
    item_id: str,
    body: OutlineItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _verify_item(item_id, db, current_user)
    data = body.model_dump(exclude_none=True)

    # Recompute level if parent changed
    if "parent_id" in data:
        new_parent_id = data["parent_id"]
        if new_parent_id:
            parent = db.get(OutlineItem, new_parent_id)
            data["level"] = (parent.level + 1) if parent else 0
        else:
            data["level"] = 0

    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    item.children = []
    return item


@router.delete("/outline/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outline_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _verify_item(item_id, db, current_user)
    db.delete(item)
    db.commit()


@router.post("/stories/{story_id}/outline/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_outline(
    story_id: str,
    body: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder siblings under a given parent (or at root level)."""
    _verify_story(story_id, db, current_user)
    for position, item_id in enumerate(body.item_ids):
        item = db.get(OutlineItem, item_id)
        if item and item.story_id == story_id:
            item.position = position
    db.commit()


@router.post("/stories/{story_id}/outline/bulk-reorder", status_code=status.HTTP_204_NO_CONTENT)
def bulk_reorder_outline(
    story_id: str,
    body: BulkReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update parent_id and position for all items after a drag-and-drop."""
    _verify_story(story_id, db, current_user)
    for op in body.operations:
        item = db.get(OutlineItem, op.item_id)
        if not item or item.story_id != story_id:
            continue
        item.parent_id = op.parent_id
        item.position = op.position
        # Recompute level from parent
        if op.parent_id:
            parent = db.get(OutlineItem, op.parent_id)
            item.level = (parent.level + 1) if parent else 0
        else:
            item.level = 0
    db.commit()
