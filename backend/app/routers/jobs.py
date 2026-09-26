"""
Long-running AI work: queue it, watch it, stop it (doc 06 §8).

Summarising a manuscript used to hold a request open for minutes. Now it is a job with a
place in a list, a progress count and a stop button — and if the server restarts mid-run,
the job says so rather than disappearing.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.ai_job import AIJob
from ..models.story import Story
from ..models.user import User
from ..schemas.chronicle import ActivityLogOut
from ..schemas.jobs import JobOut
from ..services.chronicle_timeline import job_activity
from ..services.job_queue import enqueue, handler, request_cancel
from ..services.scene_summaries import refresh_scene_summaries

router = APIRouter()


@handler("scene-summaries")
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
    )


def _story_or_404(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    story_id: str | None = None,
    active_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """This user's jobs, newest first."""
    q = db.query(AIJob).filter(AIJob.user_id == user.id)
    if story_id:
        q = q.filter(AIJob.story_id == story_id)
    if active_only:
        q = q.filter(AIJob.status.in_(["queued", "running"]))
    return q.order_by(AIJob.created_at.desc()).limit(min(limit, 200)).all()


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/activity", response_model=list[ActivityLogOut])
def get_job_activity(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What the job did: every AI call and log row it wrote, in order."""
    job = db.get(AIJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_activity(db, job_id)


@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Ask a job to stop. A queued job stops now; a running one finishes its current scene
    first, so nothing is left half-written.
    """
    job = db.get(AIJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in ("done", "error", "cancelled"):
        return job
    return request_cancel(db, job)


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
        label=f"Scene summaries — {story.title}",
        params={"force_refresh": force_refresh, "up_to_node_id": up_to_node_id},
    )
