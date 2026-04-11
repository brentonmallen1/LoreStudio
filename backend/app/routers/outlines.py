from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.outline import Outline, OutlineItem
from ..models.beat_sheet import BeatSheet
from ..schemas.outline import (
    OutlineCreate, OutlineUpdate, OutlineOut, OutlineWithItemsOut,
    InjectBeatSheetPayload,
    OutlineItemCreate, OutlineItemUpdate, OutlineItemOut,
    ReorderPayload, BulkReorderPayload,
)
from ..auth.dependencies import get_current_user

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_outline(outline_id: str, db: Session, user: User) -> Outline:
    outline = db.get(Outline, outline_id)
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    _verify_story(outline.story_id, db, user)
    return outline


def _verify_item(item_id: str, db: Session, user: User) -> OutlineItem:
    item = db.get(OutlineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Outline item not found")
    _verify_outline(item.outline_id, db, user)
    return item


def _build_tree(items: list[OutlineItem]) -> list[OutlineItemOut]:
    """Arrange flat list into a parent→children tree (root items only at top level)."""
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


# ── Outline CRUD ───────────────────────────────────────────────────────────────

@router.get("/stories/{story_id}/outlines", response_model=list[OutlineOut])
def list_outlines(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    return (
        db.query(Outline)
        .filter(Outline.story_id == story_id)
        .order_by(Outline.position.asc())
        .all()
    )


@router.post("/stories/{story_id}/outlines", response_model=OutlineOut, status_code=status.HTTP_201_CREATED)
def create_outline(
    story_id: str,
    body: OutlineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    position = db.query(Outline).filter(Outline.story_id == story_id).count()
    outline = Outline(story_id=story_id, name=body.name, position=position)
    db.add(outline)
    db.commit()
    db.refresh(outline)
    return outline


@router.post("/stories/{story_id}/outlines/inject", response_model=OutlineWithItemsOut, status_code=status.HTTP_201_CREATED)
def inject_beat_sheet(
    story_id: str,
    body: InjectBeatSheetPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new outline pre-populated from a beat sheet's beats."""
    _verify_story(story_id, db, current_user)

    beat_sheet = db.query(BeatSheet).filter(
        BeatSheet.id == body.beat_sheet_id,
        or_(BeatSheet.is_system == True, BeatSheet.user_id == current_user.id),  # noqa: E712
    ).first()
    if not beat_sheet:
        raise HTTPException(status_code=404, detail="Beat sheet not found")

    position = db.query(Outline).filter(Outline.story_id == story_id).count()
    outline = Outline(
        story_id=story_id,
        name=beat_sheet.name,
        position=position,
        source_beat_sheet_id=beat_sheet.id,
    )
    db.add(outline)
    db.flush()  # get outline.id before creating items

    beats = sorted(beat_sheet.beats or [], key=lambda b: b.get("position_pct", 0))
    items = []
    for idx, beat in enumerate(beats):
        item = OutlineItem(
            outline_id=outline.id,
            level=0,
            position=idx,
            text=beat.get("name", ""),
            notes=beat.get("description", ""),
        )
        db.add(item)
        items.append(item)

    db.commit()
    db.refresh(outline)

    result = OutlineWithItemsOut.model_validate(outline)
    result.items = _build_tree(items)
    return result


@router.get("/outlines/{outline_id}", response_model=OutlineWithItemsOut)
def get_outline(
    outline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    outline = _verify_outline(outline_id, db, current_user)
    items = (
        db.query(OutlineItem)
        .filter(OutlineItem.outline_id == outline_id)
        .order_by(OutlineItem.position.asc())
        .all()
    )
    result = OutlineWithItemsOut.model_validate(outline)
    result.items = _build_tree(items)
    return result


@router.patch("/outlines/{outline_id}", response_model=OutlineOut)
def update_outline(
    outline_id: str,
    body: OutlineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    outline = _verify_outline(outline_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(outline, key, value)
    db.commit()
    db.refresh(outline)
    return outline


@router.delete("/outlines/{outline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outline(
    outline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    outline = _verify_outline(outline_id, db, current_user)
    db.delete(outline)
    db.commit()


# ── OutlineItem CRUD ───────────────────────────────────────────────────────────

@router.get("/outlines/{outline_id}/items", response_model=list[OutlineItemOut])
def get_outline_items(
    outline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_outline(outline_id, db, current_user)
    items = (
        db.query(OutlineItem)
        .filter(OutlineItem.outline_id == outline_id)
        .order_by(OutlineItem.position.asc())
        .all()
    )
    return _build_tree(items)


@router.post("/outlines/{outline_id}/items", response_model=OutlineItemOut, status_code=status.HTTP_201_CREATED)
def create_outline_item(
    outline_id: str,
    body: OutlineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_outline(outline_id, db, current_user)

    level = 0
    if body.parent_id:
        parent = db.get(OutlineItem, body.parent_id)
        if parent:
            level = parent.level + 1

    position = body.position
    if position == 0:
        siblings = (
            db.query(OutlineItem)
            .filter(
                OutlineItem.outline_id == outline_id,
                OutlineItem.parent_id == body.parent_id,
            )
            .count()
        )
        position = siblings

    item = OutlineItem(
        outline_id=outline_id,
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


@router.patch("/outline-items/{item_id}", response_model=OutlineItemOut)
def update_outline_item(
    item_id: str,
    body: OutlineItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _verify_item(item_id, db, current_user)
    data = body.model_dump(exclude_none=True)

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


@router.delete("/outline-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outline_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _verify_item(item_id, db, current_user)
    db.delete(item)
    db.commit()


@router.post("/outlines/{outline_id}/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_outline(
    outline_id: str,
    body: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reorder siblings under a given parent (or at root level)."""
    _verify_outline(outline_id, db, current_user)
    for position, item_id in enumerate(body.item_ids):
        item = db.get(OutlineItem, item_id)
        if item and item.outline_id == outline_id:
            item.position = position
    db.commit()


@router.post("/outlines/{outline_id}/bulk-reorder", status_code=status.HTTP_204_NO_CONTENT)
def bulk_reorder_outline(
    outline_id: str,
    body: BulkReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update parent_id and position for all items after a drag-and-drop."""
    _verify_outline(outline_id, db, current_user)
    for op in body.operations:
        item = db.get(OutlineItem, op.item_id)
        if not item or item.outline_id != outline_id:
            continue
        item.parent_id = op.parent_id
        item.position = op.position
        if op.parent_id:
            parent = db.get(OutlineItem, op.parent_id)
            item.level = (parent.level + 1) if parent else 0
        else:
            item.level = 0
    db.commit()
