from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.beat_sheet import BeatSheet
from ..models.outline import Outline, OutlineItem
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import ExtractedOutlineResponse, OutlineAlignmentResponse, StructuredResult
from ..schemas.outline import (
    BulkReorderPayload,
    InjectBeatSheetPayload,
    OutlineCreate,
    OutlineItemCreate,
    OutlineItemOut,
    OutlineItemUpdate,
    OutlineOut,
    OutlineUpdate,
    OutlineWithItemsOut,
    ReorderPayload,
)
from ..services import change_log
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.outline import build_extract_outline_prompt, build_outline_alignment_prompt
from ..services.text_utils import prose_text

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
    by_id: dict[str, OutlineItemOut] = {item.id: OutlineItemOut.model_validate(item) for item in items}
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


def _record_create(db: Session, outline: Outline, user: User, client_id: str | None) -> None:
    """A new outline, with any items it came with: one Undo takes it away."""
    change_log.record(
        db,
        story_id=outline.story_id,
        entity_type="outline",
        entity_id=outline.id,
        action="create",
        before=None,
        after=change_log.capture_outline(outline, db),
        label=f"Add outline “{outline.name}”",
        actor_id=user.id,
        client_id=client_id,
    )


# ── Outline CRUD ───────────────────────────────────────────────────────────────


@router.get("/stories/{story_id}/outlines", response_model=list[OutlineOut])
def list_outlines(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    return db.query(Outline).filter(Outline.story_id == story_id).order_by(Outline.position.asc()).all()


@router.post("/stories/{story_id}/outlines", response_model=OutlineOut, status_code=status.HTTP_201_CREATED)
def create_outline(
    story_id: str,
    body: OutlineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    position = db.query(Outline).filter(Outline.story_id == story_id).count()
    outline = Outline(story_id=story_id, name=body.name, position=position)
    db.add(outline)
    db.flush()
    _record_create(db, outline, current_user, client_id)
    db.commit()
    db.refresh(outline)
    return outline


@router.post(
    "/stories/{story_id}/outlines/inject", response_model=OutlineWithItemsOut, status_code=status.HTTP_201_CREATED
)
def inject_beat_sheet(
    story_id: str,
    body: InjectBeatSheetPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Create a new outline pre-populated from a beat sheet's beats."""
    _verify_story(story_id, db, current_user)

    beat_sheet = (
        db.query(BeatSheet)
        .filter(
            BeatSheet.id == body.beat_sheet_id,
            or_(BeatSheet.is_system == True, BeatSheet.user_id == current_user.id),  # noqa: E712
        )
        .first()
    )
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
    db.flush()
    _record_create(db, outline, current_user, client_id)

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
        db.query(OutlineItem).filter(OutlineItem.outline_id == outline_id).order_by(OutlineItem.position.asc()).all()
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    outline = _verify_outline(outline_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        outline,
        data,
        entity_type="outline",
        story_id=outline.story_id,
        label=f"Edit {{fields}} on outline “{outline.name}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    outline = _verify_outline(outline_id, db, current_user)
    change_log.record(
        db,
        story_id=outline.story_id,
        entity_type="outline",
        entity_id=outline.id,
        action="delete",
        before=change_log.capture_outline(outline, db),
        after=None,
        label=f"Delete outline “{outline.name}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
        db.query(OutlineItem).filter(OutlineItem.outline_id == outline_id).order_by(OutlineItem.position.asc()).all()
    )
    return _build_tree(items)


@router.post("/outlines/{outline_id}/items", response_model=OutlineItemOut, status_code=status.HTTP_201_CREATED)
def create_outline_item(
    outline_id: str,
    body: OutlineItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    outline = _verify_outline(outline_id, db, current_user)

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
    db.flush()
    change_log.record(
        db,
        story_id=outline.story_id,
        entity_type="outline_item",
        entity_id=item.id,
        action="create",
        before=None,
        after={"outline_items": [change_log._row(item)]},
        label=f"Add outline item “{(item.text or '')[:40]}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    client_id: str | None = Depends(change_log.get_client_id),
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

    before, after = change_log.diff_fields(item, data)
    if before:
        change_log.record(
            db,
            story_id=item.outline.story_id,
            entity_type="outline_item",
            entity_id=item.id,
            action="update",
            before=before,
            after=after,
            label=f"Edit outline item “{(item.text or '')[:40]}”",
            actor_id=current_user.id,
            client_id=client_id,
        )
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    item = _verify_item(item_id, db, current_user)
    subtree = [item]
    stack = list(item.children or [])
    while stack:
        cur = stack.pop()
        subtree.append(cur)
        stack.extend(cur.children or [])
    change_log.record(
        db,
        story_id=item.outline.story_id,
        entity_type="outline_item",
        entity_id=item.id,
        action="delete",
        before={"outline_items": [change_log._row(i) for i in subtree]},
        after=None,
        label=f"Delete outline item “{(item.text or '')[:40]}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(item)
    db.commit()


@router.post("/outlines/{outline_id}/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_outline(
    outline_id: str,
    body: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Reorder siblings under a given parent (or at root level)."""
    outline = _verify_outline(outline_id, db, current_user)
    before = change_log.reorder_snapshot(OutlineItem, body.item_ids, db)
    for position, item_id in enumerate(body.item_ids):
        item = db.get(OutlineItem, item_id)
        if item and item.outline_id == outline_id:
            item.position = position
    db.flush()
    after = change_log.reorder_snapshot(OutlineItem, body.item_ids, db)
    if before != after:
        change_log.record(
            db,
            story_id=outline.story_id,
            entity_type="outline_item",
            entity_id=outline_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder outline",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()


@router.post("/outlines/{outline_id}/bulk-reorder", status_code=status.HTTP_204_NO_CONTENT)
def bulk_reorder_outline(
    outline_id: str,
    body: BulkReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Bulk update parent_id and position for all items after a drag-and-drop."""
    outline = _verify_outline(outline_id, db, current_user)
    ids = [op.item_id for op in body.operations]
    before = change_log.reorder_snapshot(OutlineItem, ids, db)
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
    db.flush()
    after = change_log.reorder_snapshot(OutlineItem, ids, db)
    if before != after:
        change_log.record(
            db,
            story_id=outline.story_id,
            entity_type="outline_item",
            entity_id=outline_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder outline",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()


# ── AI: Extract outline from manuscript ───────────────────────────────────────


@router.post("/stories/{story_id}/outlines/extract-from-prose", response_model=StructuredResult)
async def extract_outline_from_prose(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyze the manuscript and generate a proposed outline with beats.
    Returns a StructuredResult containing ExtractedOutlineResponse.
    The caller reviews proposals and calls POST /stories/{id}/outlines to import selected items.
    """
    story = _verify_story(story_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)
    total_words = sum(n.word_count or 0 for n in all_nodes)

    scenes_with_content = []
    for leaf in leaves:
        if not leaf.content or not leaf.content.strip():
            continue
        excerpt = prose_text(leaf.content)[:400].strip()
        scenes_with_content.append(f"[{leaf.title or 'Untitled'}]\n{excerpt}")

    if not scenes_with_content:
        raise HTTPException(status_code=422, detail="No scene content to analyze. Write some scenes first.")

    feature_prompt = build_extract_outline_prompt(
        story_title=story.title,
        story_intent=story.narrative_intent or getattr(story, "intent", None),
        genre=story.genre or None,
        scenes_with_content=scenes_with_content,
        total_words=total_words,
    )

    ctx = AICallContext(
        feature="extract-outline",
        user_id=current_user.id,
        story_id=story_id,
        tags=["outline", "analysis", "user-initiated"],
    )

    # Resolve scene_id from scene titles in the result
    title_to_id = {(n.title or "").lower(): n.id for n in leaves}

    result = await ai_gateway.generate_structured(
        response_model=ExtractedOutlineResponse,
        messages=[{"role": "user", "content": "Extract a structural outline from this manuscript."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    # Backfill suggested_scene_id from title matching
    if result.success and result.data and result.data.get("items"):
        for item in result.data["items"]:
            if not item.get("suggested_scene_id") and item.get("suggested_scene_title"):
                scene_id = title_to_id.get(item["suggested_scene_title"].lower(), "")
                item["suggested_scene_id"] = scene_id

    return result


# ── AI: Outline alignment analysis ────────────────────────────────────────────


@router.post("/outlines/{outline_id}/analyze-alignment", response_model=StructuredResult)
async def analyze_outline_alignment(
    outline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare an existing outline against the written manuscript."""
    outline = _verify_outline(outline_id, db, current_user)
    story = _verify_story(outline.story_id, db, current_user)

    # Gather outline items as flat text
    items = (
        db.query(OutlineItem)
        .filter(OutlineItem.outline_id == outline_id)
        .order_by(OutlineItem.level.asc(), OutlineItem.position.asc())
        .all()
    )
    if not items:
        raise HTTPException(status_code=422, detail="Outline has no items to compare against.")

    def item_line(item: OutlineItem) -> str:
        indent = "  " * item.level
        return f"{indent}- {item.text}"

    outline_items = [item_line(i) for i in items]

    # Gather scene content
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == outline.story_id).all()
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)
    scenes_with_content = []
    for leaf in leaves:
        if not leaf.content or not leaf.content.strip():
            continue
        excerpt = prose_text(leaf.content)[:400].strip()
        scenes_with_content.append(f"[{leaf.title or 'Untitled'}]\n{excerpt}")

    if not scenes_with_content:
        raise HTTPException(status_code=422, detail="No scene content to compare against. Write some scenes first.")

    feature_prompt = build_outline_alignment_prompt(
        story_title=story.title,
        outline_name=outline.name,
        outline_items=outline_items,
        scenes_with_content=scenes_with_content,
    )

    ctx = AICallContext(
        feature="outline-alignment",
        user_id=current_user.id,
        story_id=outline.story_id,
        tags=["outline", "analysis", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=OutlineAlignmentResponse,
        messages=[{"role": "user", "content": f"Compare the outline '{outline.name}' against the manuscript."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
