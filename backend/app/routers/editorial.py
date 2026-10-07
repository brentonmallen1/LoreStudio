"""
Editorial Pass router.

Runs five developmental-editor analyses over a story scope and saves the
result as an ActivityLog entry (event_type="editorial_pass", category="health").

The result is also written back as inline notes on StructureNode.metadata_.
"""

import uuid
from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.note import Note
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
from ..schemas.jobs import JobOut
from ..services import change_log
from ..services.job_queue import enqueue, handler
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.editorial import (
    build_fresh_eyes_prompt,
    build_intent_gap_prompt,
    build_marginal_notes_prompt,
    build_priorities_prompt,
    build_voice_prompt,
)
from ..services.wording import count

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
    Write editorial notes as margin notes (note rows, doc 15) on the scenes they are about.
    Replaces the previous editorial notes on each scene; the author's own stay.
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
        db.query(Note).filter(Note.node_id == node.id, Note.source.like("editorial-%")).delete(
            synchronize_session=False
        )
        for n in notes:
            text = n.get("note") or n.get("comment") or n.get("question") or n.get("issue", "")
            if n.get("anchor") and text:  # Only create note if we have an anchor passage
                db.add(
                    Note(
                        story_id=node.story_id,
                        kind="note",
                        content=text,
                        node_id=node.id,
                        anchor=n["anchor"],
                        category=n.get("category", "marginal"),
                        source=f"editorial-{report_id}",
                    )
                )

    db.commit()


#: The five analyses, in the order they run: (name, response model, prompt builder).
_STEPS = ("Fresh Eyes", "Priorities", "Intent vs Execution", "Voice", "Marginal Notes")


def _prompts(story: Story, sections: list[dict], context_level: str) -> dict[str, tuple[type[BaseModel], str]]:
    intent = story.narrative_intent or story.intent or None
    genre, tone = story.genre or None, story.tone or None
    return {
        "Fresh Eyes": (
            FreshEyesResponse,
            build_fresh_eyes_prompt(
                story_title=story.title,
                story_intent=intent,
                genre=genre,
                sections=sections,
                context_level=context_level,
            ),
        ),
        "Priorities": (
            PrioritiesResponse,
            build_priorities_prompt(
                story_title=story.title, story_intent=intent, sections=sections, context_level=context_level
            ),
        ),
        "Intent vs Execution": (
            IntentGapResponse,
            build_intent_gap_prompt(story_title=story.title, story_intent=intent, sections=sections),
        ),
        "Voice": (
            VoiceResponse,
            build_voice_prompt(
                story_title=story.title, genre=genre, tone=tone, sections=sections, context_level=context_level
            ),
        ),
        "Marginal Notes": (
            MarginalNotesResponse,
            build_marginal_notes_prompt(story_title=story.title, story_intent=intent, sections=sections),
        ),
    }


def _anchored(
    fresh: FreshEyesResponse,
    priorities: PrioritiesResponse,
    gaps: IntentGapResponse,
    voice: VoiceResponse,
    marginal: MarginalNotesResponse,
) -> list[dict]:
    """Every note that names a passage, for the margin."""

    def note(section_title: str, anchor: str, text: str, category: str) -> dict:
        return {"section_title": section_title, "anchor": anchor, "note": text, "category": category}

    out = [note(q.section_title, q.anchor, q.question, "fresh-eyes") for q in fresh.questions if q.anchor]
    out += [
        note(p.section_title, p.anchor, f"[Priority {p.rank}] {p.suggestion}", "priority")
        for p in priorities.priorities
        if p.anchor
    ]
    out += [note(g.section_title, g.anchor, g.suggestion, "intent-gap") for g in gaps.gaps if g.anchor]
    out += [note(v.section_title, v.anchor, v.observation, "voice") for v in voice.sections if v.anchor and v.deviation]
    out += [note(m.section_title, m.anchor, m.comment, "marginal") for m in marginal.notes if m.anchor]
    return out


async def run_pass(  # noqa: PLR0913
    story: Story,
    body: EditorialRunRequest,
    db: Session,
    user: User,
    *,
    done: dict | None = None,
    on_step: Callable[[int, str, dict], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> ActivityLog:
    """
    The pass: five analyses one after another, then the report and its margin notes.

    `done` holds analyses already finished (a job paused for a reply, or restarted, resumes
    there); `on_step` is told after each one, and `should_stop` is asked before each. A pass
    stopped early still saves what it finished, saying so.
    """
    sections = _gather_sections(
        story_id=story.id, scope_type=body.scope_type, scope_ids=body.scope_ids, context_level=body.context_level, db=db
    )
    if not sections:
        raise HTTPException(
            status_code=422,
            detail="No written content found in the selected scope. Write some scenes before running the editor.",
        )
    ctx = AICallContext(
        feature="editorial-pass", user_id=user.id, story_id=story.id, tags=["editorial", "analysis", "user-initiated"]
    )
    message = [{"role": "user", "content": "Perform the editorial analysis."}]
    prompts = _prompts(story, sections, body.context_level)
    results: dict[str, dict] = dict(done or {})
    errors: list[str] = list(results.pop("_errors", []))
    stopped_after: int | None = None
    for i, name in enumerate(_STEPS):
        if name in results:
            continue
        if should_stop and should_stop():
            stopped_after = i
            break
        model, prompt = prompts[name]
        try:
            sr = await ai_gateway.generate_structured(
                response_model=model, messages=message, feature_prompt=prompt, context=ctx, db=db, user=user
            )
            if sr.success and sr.data:
                results[name] = model.model_validate(sr.data).model_dump()
            else:
                results[name] = model().model_dump()
                errors.append(f"{name}: {sr.raw_text or 'model error'}")
        except Exception as e:  # one analysis failing leaves the rest to run
            results[name] = model().model_dump()
            errors.append(f"{name}: {e}")
        if on_step:
            on_step(i + 1, name, {**results, "_errors": errors})

    fresh = FreshEyesResponse.model_validate(results.get("Fresh Eyes", {}))
    priorities = PrioritiesResponse.model_validate(results.get("Priorities", {}))
    gaps = IntentGapResponse.model_validate(results.get("Intent vs Execution", {}))
    voice = VoiceResponse.model_validate(results.get("Voice", {}))
    marginal = MarginalNotesResponse.model_validate(results.get("Marginal Notes", {}))
    if stopped_after is not None:
        errors.append(f"Stopped after {stopped_after} of {len(_STEPS)} analyses.")

    report_id = str(uuid.uuid4())
    anchored = _anchored(fresh, priorities, gaps, voice, marginal)
    if anchored:
        _apply_editorial_notes(sections, anchored, report_id, db)

    report_meta = EditorialReportMetadata(
        feature="editorial-pass",
        context_level=body.context_level,
        scope_type=body.scope_type,
        scope_ids=body.scope_ids,
        stats=EditorialStats(
            fresh_eyes_count=len(fresh.questions),
            priorities_count=len(priorities.priorities),
            intent_gaps_count=len(gaps.gaps),
            voice_notes_count=len(voice.sections),
            marginal_notes_count=len(marginal.notes),
        ),
        fresh_eyes=fresh,
        priorities=priorities,
        intent_gaps=gaps,
        voice=voice,
        marginal_notes=marginal,
        error="; ".join(errors) if errors else None,
    )
    log = ActivityLog(
        id=report_id,
        user_id=user.id,
        story_id=story.id,
        event_type="editorial_pass",
        category="health",
        description=f"Editorial pass: {scope_label(body)} ({body.context_level} context)",
        metadata_=report_meta.model_dump(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def scope_label(body: EditorialRunRequest) -> str:
    return {
        "story": "whole story",
        "chapters": f"{len(body.scope_ids)} chapter(s)",
        "scenes": count(len(body.scope_ids), "scene"),
    }.get(body.scope_type, body.scope_type)


@router.post("/stories/{story_id}/editorial/run", response_model=ActivityLogOut)
async def run_editorial_pass(
    story_id: str,
    body: EditorialRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run the pass inside this request (kept for scripts; the app queues it as a job)."""
    return await run_pass(_get_story(story_id, db, current_user), body, db, current_user)


@handler("editorial-pass", unique=True)
async def _run_pass_job(job: AIJob, db: Session, user: User, report) -> dict:
    """The pass as a job: progress per analysis, Stop between them, and what it finished kept
    on the job so a pause for a reply or a restart resumes rather than starting over."""
    story = db.get(Story, job.story_id)
    if story is None:
        raise RuntimeError("The story no longer exists.")
    body = EditorialRunRequest.model_validate(job.params)
    done = (job.result or {}).get("partial") or {}

    def on_step(n: int, name: str, partial: dict) -> None:
        job.result = {"partial": partial}
        nxt = _STEPS[n] if n < len(_STEPS) else "Writing the report"
        report(n, len(_STEPS), nxt)

    def should_stop() -> bool:
        db.refresh(job)
        return job.cancel_requested

    report(len([k for k in done if k in _STEPS]), len(_STEPS), "Fresh Eyes")
    try:
        log = await run_pass(story, body, db, user, done=done, on_step=on_step, should_stop=should_stop)
    except HTTPException as exc:
        raise RuntimeError(str(exc.detail)) from exc
    return {"report_id": log.id, "summary": log.description, "error": log.metadata_.get("error")}


@router.post("/stories/{story_id}/editorial/jobs", response_model=JobOut, status_code=201)
def queue_editorial_pass(
    story_id: str,
    body: EditorialRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue the pass. It runs while the author writes, and the header's Jobs list follows it.
    An empty scope is refused here, where the dialog can still say so."""
    _get_story(story_id, db, current_user)
    if not _gather_sections(
        story_id=story_id,
        scope_type=body.scope_type,
        scope_ids=body.scope_ids,
        context_level=body.context_level,
        db=db,
    ):
        raise HTTPException(
            status_code=422,
            detail="No written content found in the selected scope. Write some scenes before running the editor.",
        )
    return enqueue(
        db,
        kind="editorial-pass",
        user_id=current_user.id,
        story_id=story_id,
        label=f"Editorial pass, {scope_label(body)}",
        params=body.model_dump(),
    )


@router.delete("/stories/{story_id}/editorial/reports/{report_id}", status_code=204)
def delete_editorial_report(
    story_id: str,
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """
    Delete an editorial report and remove all inline notes it created from story nodes.
    One Undo brings both back.
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

    # Remove the margin notes this report wrote
    notes = db.query(Note).filter(Note.story_id == story_id, Note.source == f"editorial-{report_id}").all()
    change_log.record(
        db,
        story_id=story_id,
        entity_type="activity_log",
        entity_id=log.id,
        action="delete",
        before={"activity_logs": [change_log._row(log)], "notes": [change_log._row(n) for n in notes]},
        after=None,
        label="Delete editorial report",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for note in notes:
        db.delete(note)
    db.delete(log)
    db.commit()


@router.delete("/stories/{story_id}/editorial/notes", status_code=204)
def clear_all_editorial_notes(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Remove ALL editorial inline notes from every node in the story (one undoable batch)."""
    _get_story(story_id, db, current_user)

    batch = str(uuid.uuid4())
    for note in db.query(Note).filter(Note.story_id == story_id, Note.source.like("editorial-%")).all():
        change_log.record_row_delete(
            db, note, "notes", entity_type="note", story_id=story_id, label="Clear the editor's margin notes",
            actor_id=current_user.id, client_id=client_id, batch_id=batch,
        )  # fmt: skip
        db.delete(note)

    db.commit()
