from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.character import Character
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
from ..services import change_log
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.reader_knowledge import (
    build_reader_knowledge_scan_prompt,
)
from ..services.patching import check_nodes, patch_fields
from ..services.structure_order import order_of, reading_order
from ..services.text_utils import prose_text
from ..services.who_knows import character_ids
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
    # In reading order (doc 18): what the reader learns, front to back; unplaced events last.
    order = reading_order(story_id, db)
    events.sort(key=lambda e: order.get(e.node_id or "", len(order)))
    return [_enrich(e, db) for e in events]


def _check_twist(db: Session, story_id: str, twist_id: str | None) -> None:
    if twist_id is None:
        return
    twist = db.get(Twist, twist_id)
    if twist is None or twist.story_id != story_id:
        raise HTTPException(status_code=422, detail="twist_id: no such twist in this story")


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
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    check_nodes(db, story_id, body.model_dump(), ("node_id",))
    _check_twist(db, story_id, body.twist_id)
    fields = body.model_dump()
    fields["characters_who_know"] = character_ids(story_id, fields.get("characters_who_know") or [], db)
    event = ReaderKnowledgeEvent(story_id=story_id, **fields)
    db.add(event)
    db.flush()
    change_log.record_row_create(
        db,
        event,
        "reader_knowledge_events",
        entity_type="reader_knowledge_event",
        story_id=story_id,
        label=f"Add what the reader knows: {event.subject}",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    event = db.get(ReaderKnowledgeEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _verify_story(event.story_id, db, current_user)
    data = patch_fields(body, nullable={"node_id", "twist_id", "supersedes_id"})
    check_nodes(db, event.story_id, data, ("node_id",))
    _check_twist(db, event.story_id, data.get("twist_id"))
    if "characters_who_know" in data:
        data["characters_who_know"] = character_ids(event.story_id, data["characters_who_know"] or [], db)
    change_log.record_update(
        db,
        event,
        data,
        entity_type="reader_knowledge_event",
        story_id=event.story_id,
        label=f"Edit {{fields}} on what the reader knows: {event.subject}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return _enrich(event, db)


@router.delete("/reader-knowledge/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    event = db.get(ReaderKnowledgeEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    _verify_story(event.story_id, db, current_user)
    change_log.record_row_delete(
        db,
        event,
        "reader_knowledge_events",
        entity_type="reader_knowledge_event",
        story_id=event.story_id,
        label=f"Delete what the reader knows: {event.subject}",
        actor_id=current_user.id,
        client_id=client_id,
    )
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
    twist: str | None = None


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

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    order = order_of(all_nodes)
    child_ids = {n.parent_id for n in all_nodes if n.parent_id}
    scenes = [
        # A written scene with no synopsis is read from its opening (it was sent blank).
        {"id": n.id, "title": n.title or "Untitled", "synopsis": n.synopsis or prose_text(n.content or "")[:400]}
        for n in sorted(all_nodes, key=lambda n: order.get(n.id, 0))
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
        characters=[c.name for c in db.query(Character).filter(Character.story_id == story_id) if c.name],
        twists=[{"name": t.name, "truth": t.the_truth} for t in db.query(Twist).filter(Twist.story_id == story_id)],
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
