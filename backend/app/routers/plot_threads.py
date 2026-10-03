from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import StructuredResult, ThreadAnalysisResponse
from ..schemas.plot_thread import (
    PlotThreadAppearanceCreate,
    PlotThreadAppearanceOut,
    PlotThreadCreate,
    PlotThreadOut,
    PlotThreadUpdate,
)
from ..services import change_log
from ..services.color_slots import next_slot
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.threads import build_thread_analysis_prompt
from ..services.patching import check_nodes, patch_fields
from ..services.structure_order import order_of
from ..services.text_utils import prose_text

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_thread(thread_id: str, db: Session, user: User) -> PlotThread:
    thread = db.get(PlotThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    _verify_story(thread.story_id, db, user)
    return thread


def _scene_title(node_id: str, db: Session) -> str:
    node = db.get(StructureNode, node_id)
    return (node.title if node else None) or "Untitled"


@router.get("/stories/{story_id}/threads", response_model=list[PlotThreadOut])
def list_threads(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _verify_story(story_id, db, current_user)
    return db.query(PlotThread).filter(PlotThread.story_id == story_id).order_by(PlotThread.created_at.asc()).all()


@router.post("/stories/{story_id}/threads", response_model=PlotThreadOut, status_code=status.HTTP_201_CREATED)
def create_thread(
    story_id: str,
    body: PlotThreadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    check_nodes(db, story_id, body.model_dump(), ("opens_at_node_id", "closes_at_node_id"))
    thread = PlotThread(story_id=story_id, **body.model_dump())
    if not thread.color_slot:
        thread.color_slot = next_slot(
            slot for (slot,) in db.query(PlotThread.color_slot).filter(PlotThread.story_id == story_id).all()
        )
    db.add(thread)
    db.flush()
    change_log.record_row_create(
        db,
        thread,
        "plot_threads",
        entity_type="plot_thread",
        story_id=story_id,
        label=f"Add thread {thread.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(thread)
    return thread


@router.patch("/threads/{thread_id}", response_model=PlotThreadOut)
def update_thread(
    thread_id: str,
    body: PlotThreadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    thread = _verify_thread(thread_id, db, current_user)
    data = patch_fields(body, nullable={"mice_type", "opens_at_node_id", "closes_at_node_id"})
    check_nodes(db, thread.story_id, data, ("opens_at_node_id", "closes_at_node_id"))
    change_log.record_update(
        db,
        thread,
        data,
        entity_type="plot_thread",
        story_id=thread.story_id,
        label=f"Edit {{fields}} on thread {thread.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(thread, key, value)
    db.commit()
    db.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    thread = _verify_thread(thread_id, db, current_user)
    change_log.record(
        db,
        story_id=thread.story_id,
        entity_type="plot_thread",
        entity_id=thread.id,
        action="delete",
        before=change_log.capture_plot_thread(thread, db),
        after=None,
        label=f"Delete thread {thread.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(thread)
    db.commit()


@router.post(
    "/threads/{thread_id}/appearances", response_model=PlotThreadAppearanceOut, status_code=status.HTTP_201_CREATED
)
def add_appearance(
    thread_id: str,
    body: PlotThreadAppearanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    thread = _verify_thread(thread_id, db, current_user)
    check_nodes(db, thread.story_id, {"node_id": body.node_id}, ("node_id",))
    # Prevent duplicate appearances for same node
    existing = (
        db.query(PlotThreadAppearance)
        .filter(
            PlotThreadAppearance.thread_id == thread_id,
            PlotThreadAppearance.node_id == body.node_id,
        )
        .first()
    )
    if existing:
        return existing
    appearance = PlotThreadAppearance(thread_id=thread_id, node_id=body.node_id, note=body.note)
    db.add(appearance)
    db.flush()
    change_log.record_row_create(
        db,
        appearance,
        "plot_thread_appearances",
        entity_type="plot_thread_appearance",
        story_id=thread.story_id,
        label=f"Add {thread.name} to scene “{_scene_title(appearance.node_id, db)}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(appearance)
    return appearance


@router.delete("/threads/{thread_id}/appearances/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_appearance(
    thread_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    thread = _verify_thread(thread_id, db, current_user)
    appearance = (
        db.query(PlotThreadAppearance)
        .filter(
            PlotThreadAppearance.thread_id == thread_id,
            PlotThreadAppearance.node_id == node_id,
        )
        .first()
    )
    if appearance:
        change_log.record_row_delete(
            db,
            appearance,
            "plot_thread_appearances",
            entity_type="plot_thread_appearance",
            story_id=thread.story_id,
            label=f"Remove {thread.name} from scene “{_scene_title(node_id, db)}”",
            actor_id=current_user.id,
            client_id=client_id,
        )
        db.delete(appearance)
        db.commit()


@router.post("/threads/{thread_id}/analyze", response_model=StructuredResult)
async def analyze_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze a plot thread's progression, moment mapping, and quality."""
    thread = db.get(PlotThread, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    story = db.query(Story).filter(Story.id == thread.story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Thread not found")

    # The thread's scenes in reading order, written or planned, with what the author noted
    # each one does; the opening and closing scenes count even when not tagged (doc 18).
    notes = {a.node_id: a.note for a in thread.appearances}
    tagged = set(notes) | {n for n in (thread.opens_at_node_id, thread.closes_at_node_id) if n}
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == thread.story_id).all()
    order = order_of(all_nodes)
    titles = {n.id: n.title or "Untitled" for n in all_nodes}

    scenes = []
    for n in sorted(all_nodes, key=lambda n: order.get(n.id, 0)):
        if n.id not in tagged:
            continue
        role = "opens" if n.id == thread.opens_at_node_id else "closes" if n.id == thread.closes_at_node_id else ""
        scenes.append(
            {
                "id": n.id,
                "title": titles[n.id],
                "content_excerpt": prose_text(n.content or ""),
                "synopsis": n.synopsis or "",
                "note": notes.get(n.id) or "",
                "role": role,
            }
        )

    story_context = story.logline or story.premise or story.narrative_intent or ""

    feature_prompt = build_thread_analysis_prompt(
        thread=thread,
        story_title=story.title,
        story_context=story_context,
        scenes=scenes,
        titles=titles,
    )

    ctx = AICallContext(
        feature="thread-analysis",
        user_id=current_user.id,
        story_id=story.id,
        tags=["threads", "analysis", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=ThreadAnalysisResponse,
        messages=[{"role": "user", "content": f"Analyze the plot thread: {thread.name}"}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
