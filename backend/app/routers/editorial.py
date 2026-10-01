"""
Editorial Pass router.

Runs five developmental-editor analyses over a story scope and saves the
result as an ActivityLog entry (event_type="editorial_pass", category="health").

The result is also written back as inline notes on StructureNode.metadata_.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.chronicle import ActivityLogOut
from ..schemas.editorial import (
    EditorialReportMetadata,
    EditorialRunRequest,
    EditorialStats,
    FreshEyesResponse,
    IntentGapResponse,
    MarginalNotesResponse,
    PrioritiesResponse,
    VoiceResponse,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.editorial import (
    build_fresh_eyes_prompt,
    build_intent_gap_prompt,
    build_marginal_notes_prompt,
    build_priorities_prompt,
    build_voice_prompt,
)

router = APIRouter()

CONTEXT_WARNINGS = {
    "full": (
        "Full Manuscript mode sends all prose to the model. "
        "This requires a large context window (128K+ tokens) and sufficient hardware. "
        "Analysis may fail if your model cannot handle the full manuscript."
    ),
    "summaries": None,
    "section": None,
}


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _gather_sections(
    story_id: str,
    scope_type: str,
    scope_ids: list[str],
    context_level: str,
    db: Session,
) -> list[dict]:
    """
    Collect the sections (nodes with content) for the editorial run.
    Returns list of dicts with title, content, purpose, synopsis.

    For context_level "summaries", content is replaced with node.summary if available.
    For context_level "section", only return the targeted nodes.
    """
    query = db.query(StructureNode).filter(StructureNode.story_id == story_id)

    all_nodes = query.order_by(StructureNode.position).all()

    # Filter to scope
    if scope_type == "story":
        target_nodes = all_nodes
    elif scope_type == "chapters":
        # Include the chapter nodes AND their children
        chapter_ids = set(scope_ids)
        child_ids: set[str] = set()
        for n in all_nodes:
            if n.parent_id in chapter_ids:
                child_ids.add(n.id)
        in_scope = chapter_ids | child_ids
        target_nodes = [n for n in all_nodes if n.id in in_scope]
    else:
        # scenes — exact match
        scope_set = set(scope_ids)
        target_nodes = [n for n in all_nodes if n.id in scope_set]

    # Only include nodes that have content (leaf scenes)
    content_nodes = [n for n in target_nodes if n.content and n.content.strip()]

    if not content_nodes:
        return []

    sections = []
    for n in content_nodes:
        if context_level == "summaries":
            prose = n.content_summary or n.content or ""
        else:
            prose = n.content or ""
        sections.append(
            {
                "id": n.id,
                "title": n.title or "Untitled",
                "content": prose,
                "purpose": n.purpose or "",
                "synopsis": n.synopsis or "",
            }
        )

    return sections


def _apply_editorial_notes(
    sections: list[dict],
    all_notes: list[dict],
    report_id: str,
    db: Session,
) -> None:
    """
    Write editorial notes back as inline notes on StructureNode.metadata_.
    Clears previous editorial notes with matching source before writing new ones.
    Source tag: "editorial-{report_id}"
    """
    # Group notes by section title for quick lookup
    by_title: dict[str, list[dict]] = {}
    for note in all_notes:
        title = note.get("section_title", "")
        by_title.setdefault(title, []).append(note)

    # Build title→node map from sections
    title_to_id = {s["title"]: s["id"] for s in sections}

    for title, notes in by_title.items():
        node_id = title_to_id.get(title)
        if not node_id:
            continue
        node = db.get(StructureNode, node_id)
        if not node:
            continue

        # Replace previous editorial notes on this node, keep the author's own
        existing = [n for n in (node.inline_notes or []) if n.get("type") != "editorial"]

        source_tag = f"editorial-{report_id}"
        new_notes = [
            {
                "id": str(uuid.uuid4()),
                "anchor": n.get("anchor", ""),
                "note": n.get("note") or n.get("comment") or n.get("question") or n.get("issue", ""),
                "position": 0,
                "type": "editorial",
                "category": n.get("category", "marginal"),
                "source": source_tag,
            }
            for n in notes
            if n.get("anchor")  # Only create note if we have an anchor passage
        ]

        node.inline_notes = existing + new_notes

    db.commit()


@router.post("/stories/{story_id}/editorial/run", response_model=ActivityLogOut)
async def run_editorial_pass(  # noqa: C901, PLR0912, PLR0915
    story_id: str,
    body: EditorialRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run a full editorial pass on the story.

    Executes 5 LLM analyses sequentially, saves the combined result as an
    ActivityLog entry, and writes editorial inline notes onto the relevant nodes.
    """
    story = _get_story(story_id, db, current_user)

    sections = _gather_sections(
        story_id=story_id,
        scope_type=body.scope_type,
        scope_ids=body.scope_ids,
        context_level=body.context_level,
        db=db,
    )

    if not sections:
        raise HTTPException(
            status_code=422,
            detail="No written content found in the selected scope. Write some scenes before running the editor.",
        )

    ctx_base = AICallContext(
        feature="editorial-pass",
        user_id=current_user.id,
        story_id=story_id,
        tags=["editorial", "analysis", "user-initiated"],
    )

    user_message = [{"role": "user", "content": "Perform the editorial analysis."}]
    story_intent = story.narrative_intent or story.intent or None
    genre = story.genre or None
    tone = story.tone or None

    errors: list[str] = []
    report_id = str(uuid.uuid4())

    # ── 1. Fresh Eyes ──────────────────────────────────────────────────────────
    fresh_eyes_result = FreshEyesResponse()
    try:
        fresh_prompt = build_fresh_eyes_prompt(
            story_title=story.title,
            story_intent=story_intent,
            genre=genre,
            sections=sections,
            context_level=body.context_level,
        )
        sr = await ai_gateway.generate_structured(
            response_model=FreshEyesResponse,
            messages=user_message,
            feature_prompt=fresh_prompt,
            context=ctx_base,
            db=db,
            user=current_user,
        )
        if sr.success and sr.data:
            fresh_eyes_result = FreshEyesResponse.model_validate(sr.data)
        elif not sr.success:
            errors.append(f"Fresh Eyes: {sr.raw_text or 'model error'}")
    except Exception as e:
        errors.append(f"Fresh Eyes: {e}")

    # ── 2. Priorities ──────────────────────────────────────────────────────────
    priorities_result = PrioritiesResponse()
    try:
        priorities_prompt = build_priorities_prompt(
            story_title=story.title,
            story_intent=story_intent,
            sections=sections,
            context_level=body.context_level,
        )
        sr = await ai_gateway.generate_structured(
            response_model=PrioritiesResponse,
            messages=user_message,
            feature_prompt=priorities_prompt,
            context=ctx_base,
            db=db,
            user=current_user,
        )
        if sr.success and sr.data:
            priorities_result = PrioritiesResponse.model_validate(sr.data)
        elif not sr.success:
            errors.append(f"Priorities: {sr.raw_text or 'model error'}")
    except Exception as e:
        errors.append(f"Priorities: {e}")

    # ── 3. Intent vs Execution ─────────────────────────────────────────────────
    intent_gap_result = IntentGapResponse()
    try:
        intent_prompt = build_intent_gap_prompt(
            story_title=story.title,
            story_intent=story_intent,
            sections=sections,
        )
        sr = await ai_gateway.generate_structured(
            response_model=IntentGapResponse,
            messages=user_message,
            feature_prompt=intent_prompt,
            context=ctx_base,
            db=db,
            user=current_user,
        )
        if sr.success and sr.data:
            intent_gap_result = IntentGapResponse.model_validate(sr.data)
        elif not sr.success:
            errors.append(f"Intent vs Execution: {sr.raw_text or 'model error'}")
    except Exception as e:
        errors.append(f"Intent vs Execution: {e}")

    # ── 4. Voice ───────────────────────────────────────────────────────────────
    voice_result = VoiceResponse()
    try:
        voice_prompt = build_voice_prompt(
            story_title=story.title,
            genre=genre,
            tone=tone,
            sections=sections,
            context_level=body.context_level,
        )
        sr = await ai_gateway.generate_structured(
            response_model=VoiceResponse,
            messages=user_message,
            feature_prompt=voice_prompt,
            context=ctx_base,
            db=db,
            user=current_user,
        )
        if sr.success and sr.data:
            voice_result = VoiceResponse.model_validate(sr.data)
        elif not sr.success:
            errors.append(f"Voice: {sr.raw_text or 'model error'}")
    except Exception as e:
        errors.append(f"Voice: {e}")

    # ── 5. Marginal Notes ──────────────────────────────────────────────────────
    marginal_result = MarginalNotesResponse()
    try:
        marginal_prompt = build_marginal_notes_prompt(
            story_title=story.title,
            story_intent=story_intent,
            sections=sections,
        )
        sr = await ai_gateway.generate_structured(
            response_model=MarginalNotesResponse,
            messages=user_message,
            feature_prompt=marginal_prompt,
            context=ctx_base,
            db=db,
            user=current_user,
        )
        if sr.success and sr.data:
            marginal_result = MarginalNotesResponse.model_validate(sr.data)
        elif not sr.success:
            errors.append(f"Marginal Notes: {sr.raw_text or 'model error'}")
    except Exception as e:
        errors.append(f"Marginal Notes: {e}")

    # ── Build stats ────────────────────────────────────────────────────────────
    stats = EditorialStats(
        fresh_eyes_count=len(fresh_eyes_result.questions),
        priorities_count=len(priorities_result.priorities),
        intent_gaps_count=len(intent_gap_result.gaps),
        voice_notes_count=len(voice_result.sections),
        marginal_notes_count=len(marginal_result.notes),
    )

    # ── Write inline notes back to nodes ──────────────────────────────────────
    all_anchored: list[dict] = []

    for q in fresh_eyes_result.questions:
        if q.anchor:
            all_anchored.append(
                {
                    "section_title": q.section_title,
                    "anchor": q.anchor,
                    "note": q.question,
                    "category": "fresh-eyes",
                }
            )

    for p in priorities_result.priorities:
        if p.anchor:
            all_anchored.append(
                {
                    "section_title": p.section_title,
                    "anchor": p.anchor,
                    "note": f"[Priority {p.rank}] {p.suggestion}",
                    "category": "priority",
                }
            )

    for g in intent_gap_result.gaps:
        if g.anchor:
            all_anchored.append(
                {
                    "section_title": g.section_title,
                    "anchor": g.anchor,
                    "note": g.suggestion,
                    "category": "intent-gap",
                }
            )

    for vs in voice_result.sections:
        if vs.anchor and vs.deviation:
            all_anchored.append(
                {
                    "section_title": vs.section_title,
                    "anchor": vs.anchor,
                    "note": vs.observation,
                    "category": "voice",
                }
            )

    for mn in marginal_result.notes:
        if mn.anchor:
            all_anchored.append(
                {
                    "section_title": mn.section_title,
                    "anchor": mn.anchor,
                    "note": mn.comment,
                    "category": "marginal",
                }
            )

    if all_anchored:
        _apply_editorial_notes(sections, all_anchored, report_id, db)

    # ── Save ActivityLog ───────────────────────────────────────────────────────
    report_meta = EditorialReportMetadata(
        feature="editorial-pass",
        context_level=body.context_level,
        scope_type=body.scope_type,
        scope_ids=body.scope_ids,
        stats=stats,
        fresh_eyes=fresh_eyes_result,
        priorities=priorities_result,
        intent_gaps=intent_gap_result,
        voice=voice_result,
        marginal_notes=marginal_result,
        error="; ".join(errors) if errors else None,
    )

    scope_label = {
        "story": "whole story",
        "chapters": f"{len(body.scope_ids)} chapter(s)",
        "scenes": f"{len(body.scope_ids)} scene(s)",
    }.get(body.scope_type, body.scope_type)

    log = ActivityLog(
        id=report_id,
        user_id=current_user.id,
        story_id=story_id,
        event_type="editorial_pass",
        category="health",
        description=f"Editorial pass — {scope_label} ({body.context_level} context)",
        metadata_=report_meta.model_dump(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/stories/{story_id}/editorial/reports/{report_id}", status_code=204)
def delete_editorial_report(
    story_id: str,
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an editorial report and remove all inline notes it created from story nodes.
    """
    _get_story(story_id, db, current_user)

    log = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.id == report_id,
            ActivityLog.story_id == story_id,
            ActivityLog.user_id == current_user.id,
            ActivityLog.event_type == "editorial_pass",
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Report not found")

    # Remove editorial inline notes from all nodes that have this source tag
    source_tag = f"editorial-{report_id}"
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    for node in nodes:
        notes = node.inline_notes or []
        filtered = [n for n in notes if n.get("source") != source_tag]
        if len(filtered) != len(notes):
            node.inline_notes = filtered

    db.delete(log)
    db.commit()


@router.delete("/stories/{story_id}/editorial/notes", status_code=204)
def clear_all_editorial_notes(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove ALL editorial inline notes from every node in the story."""
    _get_story(story_id, db, current_user)

    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    for node in nodes:
        notes = node.inline_notes or []
        filtered = [n for n in notes if n.get("type") != "editorial"]
        if len(filtered) != len(notes):
            node.inline_notes = filtered

    db.commit()
