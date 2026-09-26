"""
The AI job queue: work that takes minutes, with progress and a stop button (doc 06 §8).

Summarising every scene in a manuscript held a request open for as long as it took, with
nothing to watch and no way to stop. A job records what was asked for, how far it got and
what came of it, and the worker runs one at a time in the same process — a single
container stays a single container.

Handlers register themselves with `@handler("kind")` and receive a session of their own,
the job, and a `report` callback for progress. They must check `job.cancel_requested`
between steps: cancelling is a request, not a kill.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from datetime import UTC, datetime

from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.user import User

logger = logging.getLogger(__name__)

#: How long the worker waits before looking for work again.
IDLE_SECONDS = 2.0

JobHandler = Callable[[AIJob, Session, User, "ProgressFn"], Awaitable[dict]]
ProgressFn = Callable[[int, int], None]

JOB_HANDLERS: dict[str, JobHandler] = {}

#: The job the current task is running, if any. Set by `run_job` around the handler.
current_job_id: ContextVar[str | None] = ContextVar("current_job_id", default=None)


@event.listens_for(ActivityLog, "before_insert")
def _stamp_job(_mapper, _connection, log: ActivityLog) -> None:
    """
    Tag every activity row written while a job runs with that job's id.

    This is what lets a finished job open onto the calls it made. Doing it here rather
    than in the gateway catches every row a handler writes — AI calls, and the summary
    rows handlers add themselves — without each one having to remember.
    """
    job_id = current_job_id.get()
    if job_id and not (log.metadata_ or {}).get("job_id"):
        log.metadata_ = {**(log.metadata_ or {}), "job_id": job_id}


def handler(kind: str) -> Callable[[JobHandler], JobHandler]:
    """Register the coroutine that runs a kind of job."""

    def register(fn: JobHandler) -> JobHandler:
        JOB_HANDLERS[kind] = fn
        return fn

    return register


def enqueue(
    db: Session, *, kind: str, user_id: str, label: str, story_id: str | None = None, params: dict | None = None
) -> AIJob:
    """Put a job in the queue. The worker picks it up within a couple of seconds."""
    if kind not in JOB_HANDLERS:
        raise ValueError(f"unknown job kind: {kind}")
    job = AIJob(kind=kind, user_id=user_id, story_id=story_id, label=label, params=params or {})
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def request_cancel(db: Session, job: AIJob) -> AIJob:
    """
    Ask a job to stop. A queued job stops immediately; a running one stops at its next
    step, because interrupting a call mid-flight would leave the work half-recorded.
    """
    if job.status == "queued":
        job.status = "cancelled"
        job.finished_at = datetime.now(UTC).replace(tzinfo=None)
    elif job.status == "running":
        job.cancel_requested = True
    db.commit()
    db.refresh(job)
    return job


def _claim_next(db: Session) -> AIJob | None:
    """The oldest queued job, marked running so a second worker cannot take it."""
    job = db.query(AIJob).filter(AIJob.status == "queued").order_by(AIJob.created_at).first()
    if not job:
        return None
    job.status = "running"
    job.started_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return job


async def run_job(job: AIJob, db: Session) -> None:
    """Run one job to completion, recording how it ended either way."""
    user = db.get(User, job.user_id)
    job_handler = JOB_HANDLERS.get(job.kind)
    if not user or not job_handler:
        job.status = "error"
        job.error = "This job's user or handler no longer exists."
        job.finished_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        return

    def report(progress: int, total: int) -> None:
        job.progress = progress
        job.total = total
        db.commit()

    token = current_job_id.set(job.id)
    try:
        result = await job_handler(job, db, user, report)
        db.refresh(job)
        job.status = "cancelled" if job.cancel_requested else "done"
        job.result = result
    except Exception as exc:  # a failed job is a result too
        # Roll back before touching `job`: its attributes expired at the last commit, so
        # reading `job.id` reloads it, and a session still holding a failed flush refuses.
        # Logging first raised a second error out of here and left the job "running"
        # for good.
        db.rollback()
        logger.exception("job %s (%s) failed", job.id, job.kind)
        db.refresh(job)
        job.status = "error"
        job.error = str(exc)[:2000]
    finally:
        current_job_id.reset(token)
    job.finished_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()


async def worker_loop(engine: Engine) -> None:
    """One job at a time, forever. Started at lifespan, cancelled at shutdown."""
    while True:
        try:
            with Session(engine) as db:
                job = _claim_next(db)
                if job:
                    await run_job(job, db)
                    continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("job worker hit an error; continuing")
        await asyncio.sleep(IDLE_SECONDS)


def recover_interrupted(db: Session) -> int:
    """
    A job that was running when the process stopped cannot be resumed; say so rather than
    leaving it spinning in the list forever. Called at startup.
    """
    stuck = db.query(AIJob).filter(AIJob.status == "running").all()
    for job in stuck:
        job.status = "error"
        job.error = "Interrupted by a restart."
        job.finished_at = datetime.now(UTC).replace(tzinfo=None)
    if stuck:
        db.commit()
    return len(stuck)
