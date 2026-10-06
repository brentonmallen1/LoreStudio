import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.ai_job import AIJob
from ..models.numbers_reading import NumbersReading
from ..models.story import Story
from ..models.user import User
from ..schemas.jobs import JobOut
from ..schemas.numbers import NumbersOut, ReadingOut, ReadingsOut, ReadingSummary
from ..services.job_queue import enqueue, handler
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


@handler(BACKFILL)
async def _run_backfill(job: AIJob, db: Session, user: User, report) -> dict:
    """Measure each earlier version with no reading, newest first, yielding between versions
    so the server keeps answering, and stopping when asked."""
    story = db.get(Story, job.story_id)
    if story is None:
        return {"measured": 0, "of": 0}
    todo = unmeasured_snapshots(story.id, db)
    done = 0
    for i, snap in enumerate(todo):
        db.refresh(job)
        if job.cancel_requested:
            break
        done += measure_version(story, snap, db)
        report(i + 1, len(todo))
        await asyncio.sleep(0)
    thin(story.id, db)
    db.commit()
    return {"measured": done, "of": len(todo)}


@router.post("/stories/{story_id}/numbers/readings/backfill", response_model=JobOut, status_code=201)
def queue_backfill(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Measure the earlier versions, on the job queue: progress, Cancel, and it carries on if
    the author closes the page. One at a time: a second ask returns the job already going."""
    story = _story_or_404(story_id, db, user)
    running = (
        db.query(AIJob)
        .filter(AIJob.story_id == story_id, AIJob.kind == BACKFILL, AIJob.status.in_(("queued", "running")))
        .first()
    )
    if running:
        return running
    return enqueue(
        db, kind=BACKFILL, user_id=user.id, story_id=story_id, label=f"Measuring earlier versions: {story.title}"
    )
