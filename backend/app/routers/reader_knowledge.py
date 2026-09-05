from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.twist import Twist
from ..models.user import User
from ..schemas.reader_knowledge import (
    ReaderKnowledgeEventCreate,
    ReaderKnowledgeEventOut,
    ReaderKnowledgeEventUpdate,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.reader_knowledge import (
    build_reader_knowledge_scan_prompt,
)

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _enrich(event: ReaderKnowledgeEvent, db: Session) -> ReaderKnowledgeEventOut:
    node_title = None
    if event.node_id:
        node = db.get(StructureNode, event.node_id)
        node_title = node.title if node else None

    twist_name = None
    if event.twist_id:
        twist = db.get(Twist, event.twist_id)
        twist_name = twist.name if twist else None

    out = ReaderKnowledgeEventOut.model_validate(event)
    out.node_title = node_title
    out.twist_name = twist_name
    return out


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.get("/stories/{story_id}/reader-knowledge", response_model=list[ReaderKnowledgeEventOut])
def list_events(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    events = (
        db.query(ReaderKnowledgeEvent)
        .filter(ReaderKnowledgeEvent.story_id == story_id)
        .order_by(ReaderKnowledgeEvent.created_at.asc())
        .all()
    )
    return [_enrich(e, db) for e in events]


@router.post(
    "/stories/{story_id}/reader-knowledge",
    response_model=ReaderKnowledgeEventOut,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    story_id: str,
    body: ReaderKnowledgeEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    event = ReaderKnowledgeEvent(story_id=story_id, **body.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return _enrich(event, db)


@router.get("/reader-knowledge/{event_id}", response_model=ReaderKnowledgeEventOut)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(ReaderKnowledgeEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _verify_story(event.story_id, db, current_user)
    return _enrich(event, db)


@router.patch("/reader-knowledge/{event_id}", response_model=ReaderKnowledgeEventOut)
def update_event(
    event_id: str,
    body: ReaderKnowledgeEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(ReaderKnowledgeEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _verify_story(event.story_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return _enrich(event, db)


@router.delete("/reader-knowledge/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(ReaderKnowledgeEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _verify_story(event.story_id, db, current_user)
    db.delete(event)
    db.commit()


# ── AI Scan ───────────────────────────────────────────────────────────────────


@router.post("/stories/{story_id}/reader-knowledge/scan", response_model=list[ReaderKnowledgeEventOut])
async def scan_for_knowledge_events(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Use AI to auto-detect reader knowledge events from scene synopses."""
    story = _verify_story(story_id, db, current_user)

    # Gather scenes (leaf nodes with content or synopsis)
    all_nodes = (
        db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position.asc()).all()
    )
    child_ids = {n.parent_id for n in all_nodes if n.parent_id}
    scenes = [
        {"id": n.id, "title": n.title or "Untitled", "synopsis": n.synopsis or ""}
        for n in all_nodes
        if n.id not in child_ids and (n.synopsis or n.content)
    ]

    if not scenes:
        return []

    existing = db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id).all()
    existing_dicts = [
        {"subject": e.subject, "knowledge_type": e.knowledge_type, "node_id": e.node_id} for e in existing
    ]

    feature_prompt = build_reader_knowledge_scan_prompt(
        story_title=story.title,
        scenes=scenes,
        existing_events=existing_dicts,
    )

    ctx = AICallContext(
        feature="reader-knowledge-scan",
        user_id=current_user.id,
        story_id=story_id,
        tags=["mystery", "reader-knowledge", "ai-assist", "user-initiated"],
    )

    from pydantic import BaseModel as PydanticBase

    from ..schemas.ai_responses import StructuredResult

    class ScannedEvent(PydanticBase):
        node_id: str | None = None
        knowledge_type: str = "truth_revealed"
        subject: str
        detail: str = ""
        reader_knows: bool = True
        characters_who_know: list[str] = []
        is_truth: bool = True

    class ScanResponse(PydanticBase):
        events: list[ScannedEvent] = []

    result: StructuredResult = await ai_gateway.generate_structured(
        response_model=ScanResponse,
        messages=[{"role": "user", "content": "Please scan these scenes for reader knowledge events."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    if not result.success or not result.data:
        return []

    # Build valid knowledge_type set for filtering
    valid_types = {
        "truth_revealed",
        "misdirection_planted",
        "clue_planted",
        "character_learns",
        "reader_only",
    }

    created = []
    for ev in result.data.get("events") or []:
        kt = ev.get("knowledge_type", "truth_revealed")
        if kt not in valid_types:
            kt = "truth_revealed"

        event = ReaderKnowledgeEvent(
            story_id=story_id,
            node_id=ev.get("node_id"),
            knowledge_type=kt,
            subject=ev.get("subject", "Unknown"),
            detail=ev.get("detail", ""),
            reader_knows=ev.get("reader_knows", True),
            characters_who_know=ev.get("characters_who_know", []),
            is_truth=ev.get("is_truth", True),
        )
        db.add(event)
        db.flush()
        created.append(_enrich(event, db))

    db.commit()
    return created
