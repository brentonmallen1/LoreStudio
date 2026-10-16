"""The Outline's Not placed yet tray (doc 29 D3): ideas for what should happen, without a place.

Jot, rename, reorder and delete an idea; place one, and it becomes a planned scene at that spot
in the Outline and leaves the tray, as one change. Every write records, so ⌘Z takes it back.
Studio's Fill the tray from my prose reads the prose for ideas; the picks come back through
``/tray/many``.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.note import Note
from ..models.outline import Outline, OutlineItem
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import ExtractedOutlineResponse, StructuredResult
from ..schemas.outline import TrayItemCreate, TrayItemOut, TrayItemsCreate, TrayItemUpdate, TrayPlace, TrayReorder
from ..schemas.structure import StructureNodeOut
from ..services import assistant_results, change_log
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.outline import build_extract_outline_prompt
from ..services.text_utils import prose_text
from ..services.tray import TRAY_NAME, idea_to_scene, ideas_of, tray_of

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _idea(item_id: str, db: Session, user: User) -> tuple[OutlineItem, Story]:
    item = db.get(OutlineItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="That idea is not in the tray any more")
    return item, _story(item.outline.story_id, db, user)


def _short(text: str) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= 40 else text[:39] + "…"


def _tray(db: Session, story_id: str, user: User, client_id: str | None, batch: str) -> Outline:
    """The story's tray, made with its first idea (in the same change, so one Undo clears both)."""
    tray = tray_of(db, story_id)
    if tray:
        return tray
    tray = Outline(story_id=story_id, name=TRAY_NAME, position=0)
    db.add(tray)
    db.flush()
    change_log.record_row_create(
        db,
        tray,
        "outlines",
        entity_type="outline",
        story_id=story_id,
        label="Start the Not placed yet tray",
        actor_id=user.id,
        client_id=client_id,
        batch_id=batch,
    )
    return tray


def _add(
    db: Session, story_id: str, body: TrayItemCreate, user: User, client_id: str | None, batch: str
) -> OutlineItem:
    tray = _tray(db, story_id, user, client_id, batch)
    ideas = ideas_of(db, story_id)
    at = len(ideas) if body.position is None else max(0, min(body.position, len(ideas)))
    for later in ideas[at:]:
        later.position += 1
    item = OutlineItem(outline_id=tray.id, level=0, position=at, text=body.text.strip(), notes=body.notes)
    db.add(item)
    db.flush()
    change_log.record_row_create(
        db,
        item,
        "outline_items",
        entity_type="outline_item",
        story_id=story_id,
        label=f"Jot the idea “{_short(item.text)}”",
        actor_id=user.id,
        client_id=client_id,
        batch_id=batch,
    )
    return item


@router.get("/stories/{story_id}/tray", response_model=list[TrayItemOut])
def list_tray(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _story(story_id, db, current_user)
    return ideas_of(db, story_id)


@router.post("/stories/{story_id}/tray", response_model=TrayItemOut, status_code=status.HTTP_201_CREATED)
def add_idea(
    story_id: str,
    body: TrayItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, current_user)
    item = _add(db, story_id, body, current_user, client_id, str(uuid.uuid4()))
    db.commit()
    db.refresh(item)
    return item


@router.post("/stories/{story_id}/tray/many", response_model=list[TrayItemOut], status_code=status.HTTP_201_CREATED)
def add_ideas(
    story_id: str,
    body: TrayItemsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, current_user)
    batch = str(uuid.uuid4())
    made = [
        _add(db, story_id, TrayItemCreate(text=i.text, notes=i.notes), current_user, client_id, batch)
        for i in body.items
    ]
    db.commit()
    for item in made:
        db.refresh(item)
    return made


@router.patch("/tray-items/{item_id}", response_model=TrayItemOut)
def edit_idea(
    item_id: str,
    body: TrayItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    item, story = _idea(item_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "text" in data:
        data["text"] = data["text"].strip()
    change_log.record_update(
        db,
        item,
        data,
        entity_type="outline_item",
        story_id=story.id,
        label=f"Edit the idea “{_short(item.text)}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/tray-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_idea(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    item, story = _idea(item_id, db, current_user)
    _drop(db, item, story.id, current_user, client_id, str(uuid.uuid4()), f"Delete the idea “{_short(item.text)}”")
    db.commit()


def _drop(db: Session, item: OutlineItem, story_id: str, user: User, client_id: str | None, batch: str, label: str):
    """An idea out of the tray, with anything an old board nested under it."""
    rows, stack = [], [item]
    while stack:
        row = stack.pop()
        rows.append(row)
        stack.extend(row.children or [])
    change_log.record(
        db,
        story_id=story_id,
        entity_type="outline_item",
        entity_id=item.id,
        action="delete",
        before={"outline_items": [change_log._row(r) for r in rows]},
        after=None,
        label=label,
        actor_id=user.id,
        client_id=client_id,
        batch_id=batch,
    )
    db.delete(item)


@router.post("/stories/{story_id}/tray/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tray(
    story_id: str,
    body: TrayReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, current_user)
    mine = {i.id: i for i in ideas_of(db, story_id)}
    ids = [i for i in body.item_ids if i in mine]
    before = change_log.reorder_snapshot(OutlineItem, ids, db)
    for position, item_id in enumerate(ids):
        mine[item_id].position = position
    db.flush()
    after = change_log.reorder_snapshot(OutlineItem, ids, db)
    if before != after:
        change_log.record(
            db,
            story_id=story_id,
            entity_type="outline_item",
            entity_id=story_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder the Not placed yet tray",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()


@router.post("/tray-items/{item_id}/place", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def place_idea(
    item_id: str,
    body: TrayPlace,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """The idea becomes a planned scene at that spot, and leaves the tray: one change."""
    item, story = _idea(item_id, db, current_user)
    if body.parent_id:
        parent = db.get(StructureNode, body.parent_id)
        if not parent or parent.story_id != story.id:
            raise HTTPException(status_code=404, detail="That part of the Outline is not there any more")
    batch = str(uuid.uuid4())
    title, synopsis = idea_to_scene(item.text)
    siblings = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id == story.id,
            StructureNode.parent_id.is_(None) if body.parent_id is None else StructureNode.parent_id == body.parent_id,
        )
        .order_by(StructureNode.position.asc())
        .all()
    )
    at = max(0, min(body.position, len(siblings)))
    # Every sibling numbered from 0 with a gap at the spot, so the order holds whatever it was.
    ids = [s.id for s in siblings]
    before = change_log.reorder_snapshot(StructureNode, ids, db)
    for index, sibling in enumerate(siblings):
        sibling.position = index if index < at else index + 1
    db.flush()
    after = change_log.reorder_snapshot(StructureNode, ids, db)
    if before != after:
        change_log.record(
            db,
            story_id=story.id,
            entity_type="structure_node",
            entity_id=story.id,
            action="reorder",
            before=before,
            after=after,
            label="Make room for a placed idea",
            actor_id=current_user.id,
            client_id=client_id,
            batch_id=batch,
        )
    node = StructureNode(
        story_id=story.id,
        parent_id=body.parent_id,
        level=body.level,
        level_type=body.level_type,
        title=title or "Untitled",
        synopsis=synopsis,
        position=at,
        status="planned",
    )
    db.add(node)
    db.flush()
    change_log.record(
        db,
        story_id=story.id,
        entity_type="structure_node",
        entity_id=node.id,
        action="create",
        before=None,
        after=change_log.capture_node_tree(node, db),
        label=f"Place the idea “{_short(item.text)}”",
        actor_id=current_user.id,
        client_id=client_id,
        batch_id=batch,
    )
    if item.notes.strip():
        note = Note(story_id=story.id, kind="note", node_id=node.id, content=item.notes.strip())
        db.add(note)
        db.flush()
        change_log.record_row_create(
            db,
            note,
            "notes",
            entity_type="note",
            story_id=story.id,
            label="Keep the idea's notes on its scene",
            actor_id=current_user.id,
            client_id=client_id,
            batch_id=batch,
        )
    _drop(db, item, story.id, current_user, client_id, batch, f"Place the idea “{_short(item.text)}”")
    db.commit()
    db.refresh(node)
    return node


@router.post("/stories/{story_id}/tray/from-prose", response_model=StructuredResult)
async def fill_tray_from_prose(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Studio: the key moments of the written scenes, offered as ideas for the tray. Nothing
    goes in until the writer picks them (``/tray/many``). The answer is kept on the story."""
    story = _story(story_id, db, current_user)
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    kids: dict[str | None, list[StructureNode]] = {}
    for n in nodes:
        kids.setdefault(n.parent_id, []).append(n)

    def leaves(parent: str | None) -> list[StructureNode]:
        out: list[StructureNode] = []
        for n in sorted(kids.get(parent, []), key=lambda x: x.position):
            out.extend(leaves(n.id) if kids.get(n.id) else [n])
        return out

    scenes = leaves(None)
    written = [
        f"[{s.title or 'Untitled'}]\n{prose_text(s.content)[:400].strip()}" for s in scenes if (s.content or "").strip()
    ]
    if not written:
        raise HTTPException(status_code=422, detail="No scene content to read. Write some scenes first.")

    ctx = AICallContext(
        feature="extract-outline",
        user_id=current_user.id,
        story_id=story_id,
        tags=["outline", "analysis", "user-initiated"],
    )
    result = await ai_gateway.generate_structured(
        response_model=ExtractedOutlineResponse,
        messages=[{"role": "user", "content": "List the key moments of this manuscript as ideas."}],
        feature_prompt=build_extract_outline_prompt(
            story_title=story.title,
            story_intent=story.narrative_intent or None,
            genre=story.genre or None,
            scenes_with_content=written,
            total_words=sum(n.word_count or 0 for n in nodes),
        ),
        context=ctx,
        db=db,
        user=current_user,
    )
    by_title = {(s.title or "").lower(): s.id for s in scenes}
    if result.success and result.data and result.data.get("items"):
        for found in result.data["items"]:
            if not found.get("suggested_scene_id") and found.get("suggested_scene_title"):
                found["suggested_scene_id"] = by_title.get(found["suggested_scene_title"].lower(), "")
    return assistant_results.keep(db, result, ctx, subject_type="story", subject_id=story_id)
