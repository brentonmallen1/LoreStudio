import asyncio
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.numbers_reading import NumbersReading
from ..models.story import Story
from ..models.user import User
from ..schemas.jobs import JobOut
from ..schemas.numbers import (
    NumbersOut,
    ReadingOut,
    ReadingsOut,
    ReadingSummary,
    TalkOut,
    TalkSubjectsRequest,
    TalkSubjectsResponse,
)
from ..services import talk as talking
from ..services.findings.view import load_view
from ..services.job_queue import enqueue, handler
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.talk import build_talk_subjects_prompt
from ..services.numbers import numbers
from ..services.numbers_history import in_background, measure_version, thin, unmeasured_snapshots

router = APIRouter()

#: The job that measures earlier versions (doc 19 P3).
BACKFILL = "numbers-backfill"


def _story_or_404(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/numbers", response_model=NumbersOut)
def story_numbers(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The story in numbers (doc 13 P3): words, dialogue, prose and summaries."""
    story = _story_or_404(story_id, db, user)
    out = numbers(story, db)
    # Reading the dialogue brings its blocks up to date with the prose first.
    db.commit()
    return out


def _summary(r: NumbersReading) -> ReadingSummary:
    d = r.data or {}
    prose = d.get("prose") or {}
    findings = d.get("findings")
    return ReadingSummary(
        id=r.id,
        taken_at=r.taken_at,
        trigger=r.trigger,
        label=r.label,
        snapshot_id=r.snapshot_id,
        words=(d.get("words") or {}).get("total", 0),
        scenes=(d.get("words") or {}).get("scenes", 0),
        balance=(d.get("dialogue") or {}).get("balance"),
        passive_pct=prose.get("passive_pct"),
        open_findings=sum(findings.values()) if findings is not None else None,
    )


@router.get("/stories/{story_id}/numbers/readings", response_model=ReadingsOut)
def list_readings(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The story's readings, oldest first, for the picker and the trend row (doc 19)."""
    _story_or_404(story_id, db, user)
    rows = (
        db.query(NumbersReading)
        .filter(NumbersReading.story_id == story_id)
        .order_by(NumbersReading.taken_at.asc())
        .all()
    )
    return ReadingsOut(
        readings=[_summary(r) for r in rows], unmeasured_versions=len(unmeasured_snapshots(story_id, db))
    )


@router.get("/stories/{story_id}/numbers/readings/{reading_id}", response_model=ReadingOut)
def get_reading(story_id: str, reading_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """One reading in full, to draw a comparison from."""
    _story_or_404(story_id, db, user)
    r = db.get(NumbersReading, reading_id)
    if r is None or r.story_id != story_id:
        raise HTTPException(status_code=404, detail="Reading not found")
    return ReadingOut(id=r.id, taken_at=r.taken_at, trigger=r.trigger, label=r.label, data=r.data)


@router.post("/stories/{story_id}/numbers/readings", status_code=202)
def measure_now(
    story_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Measure now (D1): taken after this answers, so nobody waits on it."""
    _story_or_404(story_id, db, user)
    background.add_task(in_background, db.get_bind(), story_id, trigger="manual")
    return {"queued": True}


@handler(BACKFILL, lane="local", unique=True)
async def _run_backfill(job: AIJob, db: Session, user: User, report) -> dict:
    """Measure each earlier version with no reading, newest first, each in a thread so the
    server keeps answering meanwhile, and stopping when asked."""
    story = db.get(Story, job.story_id)
    if story is None:
        return {"measured": 0, "of": 0}
    todo = unmeasured_snapshots(story.id, db)
    done = 0
    for i, snap in enumerate(todo):
        db.refresh(job)
        if job.cancel_requested:
            break
        done += await asyncio.to_thread(measure_version, story, snap, db)
        report(i + 1, len(todo))
    thin(story.id, db)
    db.commit()
    return {"measured": done, "of": len(todo)}


@router.post("/stories/{story_id}/numbers/readings/backfill", response_model=JobOut, status_code=201)
def queue_backfill(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Measure the earlier versions, on the job queue: progress, Cancel, and it carries on if
    the author closes the page. One at a time: a second ask returns the job already going."""
    story = _story_or_404(story_id, db, user)
    return enqueue(
        db, kind=BACKFILL, user_id=user.id, story_id=story_id, label=f"Measuring earlier versions: {story.title}"
    )


@router.get("/stories/{story_id}/numbers/talk", response_model=TalkOut)
def story_talk(
    story_id: str,
    group: list[str] | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Talking to each other (doc 20 P7): which scenes have the chosen group talking together."""
    story = _story_or_404(story_id, db, user)
    out = talking.talk(load_view(story, db), db, group)
    db.commit()  # the dialogue was brought up to date with the prose
    return out


@router.post("/stories/{story_id}/numbers/talk/subjects", response_model=TalkOut)
async def story_talk_subjects(
    story_id: str,
    body: TalkSubjectsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """What they talk about (Studio): a few words per exchange, and whether it is about a man.
    Logged as a run; an exchange whose words change later loses its description."""
    story = _story_or_404(story_id, db, user)
    view = load_view(story, db)
    exchanges = talking.exchange_text(view, db, body.group)
    if exchanges:
        men = [c.name for c in view.characters if re.search(r"\bm[ae]n\b", c.gender or "", re.I)]
        result = await ai_gateway.generate_structured(
            response_model=TalkSubjectsResponse,
            messages=[{"role": "user", "content": "Describe each conversation."}],
            feature_prompt=build_talk_subjects_prompt(exchanges, men),
            context=AICallContext(
                feature="talk-subjects",
                user_id=user.id,
                story_id=story.id,
                tags=["numbers", "dialogue", "user-initiated"],
            ),
            db=db,
            user=user,
        )
        if not result.success or not result.data:
            raise HTTPException(status_code=502, detail="The Assistant did not answer in shape")
        known = {e["id"] for e in exchanges}
        described = {
            x["id"]: {"about": x.get("about", ""), "about_a_man": bool(x.get("about_a_man"))}
            for x in result.data.get("exchanges", [])
            if x.get("id") in known
        }
        db.add(
            ActivityLog(
                user_id=user.id,
                story_id=story.id,
                event_type="analysis_run",
                category="health",
                description=f"What they talk about: {len(described)} conversations",
                metadata_={"feature": talking.FEATURE, "group": body.group, "result": {"exchanges": described}},
            )
        )
        db.commit()
    return talking.talk(view, db, body.group)
