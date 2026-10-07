"""
Long-running AI work: queue it, watch it, stop it (doc 06 §8).

Summarising a manuscript used to hold a request open for minutes. Now it is a job with a
place in a list, a progress count and a stop button — and if the server restarts mid-run,
the job says so rather than disappearing.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.ai_job import AIJob
from ..models.story import Story
from ..models.user import User
from ..schemas.chronicle import ActivityLogOut
from ..schemas.jobs import JobIds, JobOut
from ..services.chronicle_timeline import job_activity
from ..services.job_queue import (
    ACTIVE,
    FINISHED,
    JOB_HANDLERS,
    enqueue,
    handler,
    mark_seen,
    next_queued,
    request_cancel,
    retry,
    run_next,
    wake,
)
from ..services.llm.gate import model_gate
from ..services.scene_summaries import refresh_scene_summaries

router = APIRouter()


@handler("scene-summaries", unique=True)
async def _run_scene_summaries(job: AIJob, db: Session, user: User, report) -> dict:
    """Summarise every scene that needs it, checking after each one whether to stop."""

    def should_stop() -> bool:
        db.refresh(job)
        return job.cancel_requested

    return await refresh_scene_summaries(
        job.story_id or "",
        db,
        user,
        force_refresh=bool(job.params.get("force_refresh")),
        up_to_node_id=job.params.get("up_to_node_id"),
        on_progress=report,
        should_stop=should_stop,
        pause_when_unreachable=True,
    )


def _story_or_404(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _own_job(job_id: str, db: Session, user: User) -> AIJob:
    job = db.get(AIJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _out(jobs: list[AIJob], db: Session) -> list[JobOut]:
    """Jobs as the list shows them, each queued one with its place in its lane."""
    places: dict[str, int] = {}
    for lane in {j.lane for j in jobs if j.status == "queued"}:
        queued = (
            db.query(AIJob.id)
            .filter(AIJob.lane == lane, AIJob.status == "queued")
            .order_by(AIJob.position, AIJob.created_at)
            .all()
        )
        places.update({jid: i + 1 for i, (jid,) in enumerate(queued)})
    next_model = next_queued(db, "model") if any(j.lane == "model" and j.status == "queued" for j in jobs) else None
    return [
        JobOut.model_validate(j).model_copy(
            update={"queue_position": places.get(j.id), "stop": _stop_mode(j.kind), **_waiting(j, next_model)},
        )
        for j in jobs
    ]


def _waiting(job: AIJob, next_model: str | None) -> dict:
    """The gate's word on a model job: the next one in line says why it waits (doc 21 P3)."""
    if job.lane != "model" or job.status not in ACTIVE:
        return {}
    if job.status == "queued" and job.id != next_model:
        return {}
    reason = model_gate.waiting_reason(job.id)
    return {"waiting": reason, "can_start_now": bool(reason) and "reply goes first" not in reason}


def _stop_mode(kind: str) -> str:
    spec = JOB_HANDLERS.get(kind)
    return spec.stop if spec else "between"


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    story_id: str | None = None,
    active_only: bool = False,
    lane: str | None = None,
    since_hours: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """This user's jobs, newest first. `since_hours` keeps the running and queued ones and
    those finished within that many hours (the Jobs list); `lane=local` is Writer mode's."""
    q = db.query(AIJob).filter(AIJob.user_id == user.id)
    if story_id:
        q = q.filter(AIJob.story_id == story_id)
    if lane:
        q = q.filter(AIJob.lane == lane)
    if active_only:
        q = q.filter(AIJob.status.in_(ACTIVE))
    elif since_hours is not None:
        since = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=since_hours)
        q = q.filter(or_(AIJob.status.in_(ACTIVE), AIJob.finished_at >= since))
    return _out(q.order_by(AIJob.created_at.desc()).limit(min(limit, 200)).all(), db)


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out([_own_job(job_id, db, user)], db)[0]


@router.get("/jobs/{job_id}/activity", response_model=list[ActivityLogOut])
def get_job_activity(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What the job did: every AI call and log row it wrote, in order."""
    _own_job(job_id, db, user)
    return job_activity(db, job_id)


@router.post("/jobs/seen")
def jobs_seen(body: JobIds, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The Jobs list showed these finished, so they are no longer unseen anywhere."""
    return {"marked": mark_seen(db, user.id, body.ids)}


@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Stop a job, or take a queued one out of the queue. A running job stops now if its kind
    can (one call, written after it returns); otherwise after the step in hand, so nothing
    is left half-written.
    """
    job = _own_job(job_id, db, user)
    if job.status in FINISHED:
        return _out([job], db)[0]
    return _out([request_cancel(db, job)], db)[0]


@router.post("/jobs/{job_id}/run-next", response_model=JobOut)
def run_job_next(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Move a queued job to the front of its lane."""
    return _out([run_next(db, _own_job(job_id, db, user))], db)[0]


@router.post("/jobs/{job_id}/start-now", response_model=JobOut)
def start_job_now(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Skip the cool-down after a reply (or a pause) for this job: it goes to the front and
    starts. A reply that comes while it runs still goes first."""
    job = _own_job(job_id, db, user)
    if job.status in ACTIVE and job.lane == "model":
        run_next(db, job)
        model_gate.start_now(job.id)
        wake("model")
    return _out([job], db)[0]


@router.post("/jobs/{job_id}/retry", response_model=JobOut, status_code=201)
def retry_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Run a failed or stopped job again, as a new job that says which one it repeats."""
    job = _own_job(job_id, db, user)
    if job.status not in ("error", "cancelled"):
        raise HTTPException(status_code=409, detail="Only a failed or stopped job can be retried")
    if job.kind not in JOB_HANDLERS:
        raise HTTPException(status_code=409, detail="This kind of job no longer exists")
    return _out([retry(db, job)], db)[0]


@router.post("/stories/{story_id}/jobs/scene-summaries", response_model=JobOut, status_code=201)
def queue_scene_summaries(
    story_id: str,
    force_refresh: bool = Body(False, embed=True),
    up_to_node_id: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queue a summary refresh for the whole manuscript."""
    story = _story_or_404(story_id, db, user)
    return enqueue(
        db,
        kind="scene-summaries",
        user_id=user.id,
        story_id=story_id,
        label=f"Scene summaries: {story.title}",
        params={"force_refresh": force_refresh, "up_to_node_id": up_to_node_id},
    )
