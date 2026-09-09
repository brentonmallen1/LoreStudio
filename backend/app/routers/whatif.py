"""
"What If?" scenario simulator.

Lets authors ask counterfactual questions ("What if I kill this character?") and receive
ripple-effect analysis covering threads, arcs, pacing, and theme — without any prose generation.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.llm_params import LLMParamsOverride
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.whatif import build_whatif_system_prompt
from ..services.llm.stream_errors import stream_error

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _build_whatif_context(story: Story, db: Session) -> dict:
    """Build rich story context for counterfactual analysis."""

    # Characters with arc data
    all_chars = db.query(Character).filter(Character.story_id == story.id).all()
    char_data = []
    for c in all_chars:
        d: dict = {"name": c.name, "role": c.role}
        if getattr(c, "mission_statement", None):
            d["mission_statement"] = c.mission_statement
        elif c.motivation:
            d["motivation"] = c.motivation[:200]
        if c.arc_notes:
            d["arc_notes"] = c.arc_notes[:200]
        if c.arc_milestones:
            pending = [m["text"] for m in c.arc_milestones if not m.get("completed")]
            if pending:
                d["pending_arc_milestones"] = pending[:3]
        char_data.append(d)

    # All plot threads (all statuses for full picture)
    all_threads = db.query(PlotThread).filter(PlotThread.story_id == story.id).all()
    thread_data = [
        {
            "name": t.name,
            "status": t.status,
            "description": t.description[:150] if t.description else None,
        }
        for t in all_threads
    ]

    # Top-level structure outline
    top_nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story.id, StructureNode.parent_id.is_(None))
        .order_by(StructureNode.position)
        .all()
    )
    outline = []
    for n in top_nodes:
        entry: dict = {"title": n.title, "level_type": n.level_type}
        if n.synopsis:
            entry["synopsis"] = n.synopsis[:100]
        outline.append(entry)

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "central_conflict": story.central_conflict or None,
            "narrative_intent": story.narrative_intent or getattr(story, "intent", None) or None,
            "logline": story.logline or None,
            "premise": story.premise or None,
        },
        "characters": char_data,
        "threads": thread_data,
        "structure_outline": outline,
    }


@router.post("/stories/{story_id}/whatif")
async def whatif_simulator(
    story_id: str,
    messages: list[dict] = Body(...),
    llm_params: LLMParamsOverride | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream a counterfactual analysis for a 'What if...' scenario.

    The request body is just the conversation messages — no scene context needed,
    analysis is always story-wide.
    """
    story = _get_story(story_id, db, current_user)
    ctx = _build_whatif_context(story, db)
    system_prompt = build_whatif_system_prompt(ctx)

    call_ctx = AICallContext(
        feature="whatif",
        user_id=current_user.id,
        story_id=story_id,
        tags=["lorebook", "whatif", "scenario", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=system_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
                llm_params=llm_params,
            ):
                yield token
        except Exception as exc:
            yield stream_error(exc, where="what-if")

    return StreamingResponse(stream(), media_type="text/plain")
