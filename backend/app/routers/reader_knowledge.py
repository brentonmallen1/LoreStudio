from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.twist import Twist
from ..models.user import User
from ..schemas.ai_responses import StructuredResult
from ..schemas.reader_knowledge import (
    ReaderKnowledgeEventCreate,
    ReaderKnowledgeEventOut,
    ReaderKnowledgeEventUpdate,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.reader_knowledge import (
    build_reader_knowledge_scan_prompt,
)
from ..services.wording import count

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


KNOWLEDGE_TYPES = {"truth_revealed", "misdirection_planted", "clue_planted", "character_learns", "reader_only"}


class ScannedEvent(BaseModel):
    node_id: str | None = None
    knowledge_type: str = "truth_revealed"
    subject: str
    detail: str = ""
    reader_knows: bool = True
    characters_who_know: list[str] = []
    is_truth: bool = True


class ScanResponse(BaseModel):
    events: list[ScannedEvent] = []


class ScanOut(BaseModel):
    #: How many events the scan proposed; they wait in Proposals for a yes or no.
    proposed: int


@router.post("/stories/{story_id}/reader-knowledge/scan", response_model=ScanOut)
async def scan_for_knowledge_events(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask the Assistant what the reader learns where. Nothing is written into the Lorebook:
    what it finds is logged with the run and waits in Proposals (doc 13 P4)."""
    story = _verify_story(story_id, db, current_user)

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
        return ScanOut(proposed=0)

    existing = db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id).all()
    feature_prompt = build_reader_knowledge_scan_prompt(
        story_title=story.title,
        scenes=scenes,
        existing_events=[
            {"subject": e.subject, "knowledge_type": e.knowledge_type, "node_id": e.node_id} for e in existing
        ],
    )
    ctx = AICallContext(
        feature="reader-knowledge-scan",
        user_id=current_user.id,
        story_id=story_id,
        tags=["mystery", "reader-knowledge", "ai-assist", "user-initiated"],
    )
    result: StructuredResult = await ai_gateway.generate_structured(
        response_model=ScanResponse,
        messages=[{"role": "user", "content": "Please scan these scenes for reader knowledge events."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
    if not result.success or not result.data:
        return ScanOut(proposed=0)

    # The model names scenes by id; one it made up is dropped rather than trusted.
    scene_ids = {sc["id"] for sc in scenes}
    events = []
    for ev in result.data.get("events") or []:
        if not (ev.get("subject") or "").strip():
            continue
        events.append(
            {
                **ev,
                "node_id": ev.get("node_id") if ev.get("node_id") in scene_ids else None,
                "knowledge_type": ev.get("knowledge_type")
                if ev.get("knowledge_type") in KNOWLEDGE_TYPES
                else "truth_revealed",
            }
        )
    db.add(
        ActivityLog(
            user_id=current_user.id,
            story_id=story_id,
            event_type="analysis_run",
            category="health",
            description=f"Reader knowledge scan: {count(len(events), 'event')} proposed",
            metadata_={"feature": "reader-knowledge-scan", "result": {"events": events}},
        )
    )
    db.commit()
    return ScanOut(proposed=len(events))
