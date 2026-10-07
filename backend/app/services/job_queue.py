"""
The job queue: work that takes minutes, with progress and a stop button (doc 06 §8, doc 21).

Summarising every scene in a manuscript held a request open for as long as it took, with
nothing to watch and no way to stop. A job records what was asked for, how far it got and
what came of it. It runs in this process, so a single container stays a single container.

There are two lanes, each with one worker (doc 21 P2). The **model** lane makes one model
call at a time, because there is one local Ollama. The **local** lane runs work that never
calls a model (a sync, a measurement), so it never waits behind a twenty-minute summaries run.
Within a lane, jobs run in `position` order, and Run next moves one to the front.

Handlers register with `@handler("kind", lane=..., stop=...)`. They receive a session of
their own, the job, and a `report(progress, total, step=None)` callback. How a job stops:

- `stop="between"`: Stop is a request the handler checks between its steps (`job.cancel_requested`),
  so a step that writes as it goes is never left half-written.
- `stop="now"`: Stop cancels the handler's task at once. httpx closes the connection and the
  model stops generating. Only for work that writes its result after its call returns.

A model-lane job can also be *interrupted to make way* (`interrupt(id, "yield")`, doc 21 P3):
its call is cancelled and the job goes back to the front of its lane, to resume at its step.
"""

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

from sqlalchemy import Engine, event, func
from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob
from ..models.user import User

logger = logging.getLogger(__name__)

#: How long a worker waits before looking for work again.
IDLE_SECONDS = 2.0
#: Finished quiet jobs (automatic readings and syncs) are kept this long; the rest are kept.
QUIET_RETENTION_DAYS = 30

Lane = Literal["model", "local"]
LANES: tuple[Lane, ...] = ("model", "local")
ACTIVE = ("queued", "running")
FINISHED = ("done", "error", "cancelled")


class ProgressFn(Protocol):
    def __call__(self, progress: int, total: int, step: str | None = None) -> None: ...


JobHandler = Callable[[AIJob, Session, User, ProgressFn], Awaitable[dict]]


@dataclass(frozen=True)
class JobKind:
    run: JobHandler
    lane: Lane = "model"
    stop: Literal["now", "between"] = "between"
    #: Automatic work: listed and logged, never a toast.
    quiet: bool = False
    #: Asking again while one is queued or running returns that one.
    unique: bool = False


JOB_HANDLERS: dict[str, JobKind] = {}

#: The job the current task is running, if any. Set by `run_job` around the handler.
current_job_id: ContextVar[str | None] = ContextVar("current_job_id", default=None)

#: Running handlers by job id, with the loop they run on (a Stop arrives from a request
#: thread, so it is handed to that loop rather than called directly).
RUNNING: dict[str, tuple[asyncio.Task, asyncio.AbstractEventLoop]] = {}
#: Why a running handler was interrupted: "stop" (the author) or "yield" (a reply goes first).
_INTERRUPTS: dict[str, str] = {}


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


def handler(
    kind: str,
    *,
    lane: Lane = "model",
    stop: Literal["now", "between"] = "between",
    quiet: bool = False,
    unique: bool = False,
) -> Callable[[JobHandler], JobHandler]:
    """Register the coroutine that runs a kind of job, and how it is queued and stopped."""

    def register(fn: JobHandler) -> JobHandler:
        JOB_HANDLERS[kind] = JobKind(fn, lane=lane, stop=stop, quiet=quiet, unique=unique)
        return fn

    return register


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _front(db: Session, lane: str) -> float:
    """A position ahead of every queued job in the lane."""
    lowest = db.query(func.min(AIJob.position)).filter(AIJob.lane == lane, AIJob.status == "queued").scalar()
    return (lowest if lowest is not None else time.time()) - 1


def enqueue(
    db: Session,
    *,
    kind: str,
    user_id: str,
    label: str,
    story_id: str | None = None,
    params: dict | None = None,
    origin: Literal["author", "auto"] = "author",
    origin_note: str | None = None,
    retry_of: str | None = None,
    quiet: bool | None = None,
) -> AIJob:
    """Put a job at the back of its lane; its worker is woken for it. `quiet` overrides the
    kind's (Measure now is the author's; the same reading taken on a visit is quiet)."""
    spec = JOB_HANDLERS.get(kind)
    if spec is None:
        raise ValueError(f"unknown job kind: {kind}")
    params = params or {}
    if spec.unique:
        for job in db.query(AIJob).filter(
            AIJob.kind == kind, AIJob.user_id == user_id, AIJob.story_id == story_id, AIJob.status.in_(ACTIVE)
        ):
            if (job.params or {}) == params:
                return job
    job = AIJob(
        kind=kind,
        user_id=user_id,
        story_id=story_id,
        label=label,
        params=params,
        lane=spec.lane,
        quiet=spec.quiet if quiet is None else quiet,
        position=time.time(),
        origin=origin,
        origin_note=origin_note,
        retry_of=retry_of,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    wake(spec.lane)
    return job


#: Each lane's worker waits on its event between jobs, so a job starts as soon as it is queued.
_WAKE: dict[str, tuple[asyncio.Event, asyncio.AbstractEventLoop]] = {}


def wake(lane: str) -> None:
    """Tell a lane's worker there is work, from a request thread or the loop itself."""
    entry = _WAKE.get(lane)
    if entry is not None:
        event, loop = entry
        loop.call_soon_threadsafe(event.set)


def interrupt_reason(job_id: str) -> str | None:
    """Why a running job's handler is being interrupted, while it unwinds."""
    return _INTERRUPTS.get(job_id)


def interrupt(job_id: str, reason: Literal["stop", "yield"]) -> bool:
    """Cancel a running handler's task: the author's Stop, or making way for a reply."""
    entry = RUNNING.get(job_id)
    if entry is None:
        return False
    task, loop = entry
    _INTERRUPTS[job_id] = reason
    loop.call_soon_threadsafe(task.cancel)
    return True


def request_cancel(db: Session, job: AIJob) -> AIJob:
    """
    Stop a job. A queued one stops now. A running one stops now if its kind can, and
    otherwise at its next step, because interrupting it mid-step would leave the work
    half-recorded.
    """
    if job.status == "queued":
        job.status = "cancelled"
        job.finished_at = _now()
    elif job.status == "running":
        job.cancel_requested = True
    db.commit()
    spec = JOB_HANDLERS.get(job.kind)
    if job.status == "running" and spec and spec.stop == "now":
        interrupt(job.id, "stop")
    db.refresh(job)
    return job


def run_next(db: Session, job: AIJob) -> AIJob:
    """Move a queued job to the front of its lane."""
    if job.status == "queued":
        job.position = _front(db, job.lane)
        db.commit()
        db.refresh(job)
    return job


def retry(db: Session, job: AIJob) -> AIJob:
    """Queue a failed or stopped job again. Summaries, backfill and indexing skip the work
    already done, so a retry carries on where the first one stopped."""
    return enqueue(
        db,
        kind=job.kind,
        user_id=job.user_id,
        label=job.label,
        story_id=job.story_id,
        params=job.params,
        origin="author",
        retry_of=job.id,
    )


def mark_seen(db: Session, user_id: str, job_ids: list[str]) -> int:
    """The Jobs list showed these finished: no longer unseen, in every window."""
    n = (
        db.query(AIJob)
        .filter(AIJob.user_id == user_id, AIJob.id.in_(job_ids), AIJob.status.in_(FINISHED), AIJob.seen_at.is_(None))
        .update({AIJob.seen_at: _now()}, synchronize_session=False)
    )
    db.commit()
    return n


def next_queued(db: Session, lane: str) -> str | None:
    """The id of the job that runs next in the lane."""
    return (
        db.query(AIJob.id)
        .filter(AIJob.status == "queued", AIJob.lane == lane)
        .order_by(AIJob.position, AIJob.created_at)
        .limit(1)
        .scalar()
    )


def _model_may_start(db: Session) -> bool:
    """Replies first: nothing new starts on the model while one runs, during the cool-down
    after it, or while the lane is paused, unless the author said Start now."""
    from .llm.gate import model_gate

    next_id = next_queued(db, "model")
    return next_id is None or model_gate.may_start(next_id)


def _claim_next(db: Session, lane: str = "model") -> AIJob | None:
    """
    The first queued job in the lane, marked running so a second worker cannot take it.

    The claim is one conditional UPDATE: reading the row and then writing it let two
    workers (or a cancel landing in between) both act on the same job.
    """
    while True:
        job_id = next_queued(db, lane)
        if job_id is None:
            return None
        claimed = (
            db.query(AIJob)
            .filter(AIJob.id == job_id, AIJob.status == "queued")
            .update({AIJob.status: "running", AIJob.started_at: _now()}, synchronize_session=False)
        )
        db.commit()
        if claimed:
            return db.get(AIJob, job_id, populate_existing=True)


def _requeue_front(db: Session, job: AIJob, why: str) -> None:
    job.status = "queued"
    job.started_at = None
    job.position = _front(db, job.lane)
    job.step_label = why


_UNREACHABLE = ("error reaching llm", "connecterror", "connection refused", "all connection attempts failed")


def _pause_reason(exc: Exception) -> str | None:
    """Why the model lane should wait rather than fail the job, or None for a real failure."""
    from .llm.gateway import AIDisabledError

    if isinstance(exc, AIDisabledError):
        return "Held: the Assistant is switched off in Settings › AI."
    text = f"{type(exc).__name__}: {exc}".lower()
    if any(word in text for word in _UNREACHABLE):
        return "Paused: the model is not answering."
    return None


async def run_job(job: AIJob, db: Session) -> None:
    """Run one job to completion, recording how it ended either way."""
    user = db.get(User, job.user_id)
    spec = JOB_HANDLERS.get(job.kind)
    if not user or not spec:
        job.status = "error"
        job.error = "This job's user or handler no longer exists."
        job.finished_at = _now()
        db.commit()
        return

    def report(progress: int, total: int, step: str | None = None) -> None:
        job.progress = progress
        job.total = total
        if step is not None:
            job.step_label = step
        db.commit()

    if job.step_label:  # "Requeued after a restart", "Paused for your reply": it runs now
        job.step_label = None
        db.commit()
    token = current_job_id.set(job.id)
    task = asyncio.ensure_future(spec.run(job, db, user, report))
    RUNNING[job.id] = (task, asyncio.get_running_loop())
    try:
        result = await task
        db.refresh(job)
        job.status = "cancelled" if job.cancel_requested else "done"
        job.result = result
        job.step_label = None
    except asyncio.CancelledError:
        reason = _INTERRUPTS.pop(job.id, None)
        if reason is None:  # the server is shutting down: a restart says so (recover_interrupted)
            raise
        db.rollback()
        db.refresh(job)
        if reason == "yield":
            _requeue_front(db, job, "Paused for your reply")
            db.commit()
            return
        job.status = "cancelled"
        job.step_label = None
    except Exception as exc:  # a failed job is a result too
        # Roll back before touching `job`: its attributes expired at the last commit, so
        # reading `job.id` reloads it, and a session still holding a failed flush refuses.
        # Logging first raised a second error out of here and left the job "running"
        # for good.
        db.rollback()
        db.refresh(job)
        if job.lane == "model" and (why := _pause_reason(exc)):
            # The model is not there, or AI is off: the lane waits instead of failing every
            # job in turn (doc 21 P3), and this one goes back to the front.
            from .llm.gate import model_gate

            model_gate.pause(why)
            _requeue_front(db, job, why)
            db.commit()
            return
        logger.exception("job %s (%s) failed", job.id, job.kind)
        job.status = "error"
        job.error = str(exc)[:2000]
        job.step_label = None
    finally:
        RUNNING.pop(job.id, None)
        _INTERRUPTS.pop(job.id, None)
        current_job_id.reset(token)
        if job.lane == "model":
            from .llm.gate import model_gate

            model_gate.finished(job.id)
    job.finished_at = _now()
    db.commit()


async def worker_loop(engine: Engine, lane: Lane = "model") -> None:
    """One job at a time in one lane, forever. Started at lifespan, cancelled at shutdown.
    Between jobs it waits to be woken, or IDLE_SECONDS at most."""
    event = asyncio.Event()
    _WAKE[lane] = (event, asyncio.get_running_loop())
    while True:
        event.clear()  # before looking, so a job queued while we look still wakes the wait
        gated = False
        try:
            with Session(engine) as db:
                gated = lane == "model" and not _model_may_start(db)
                job = None if gated else _claim_next(db, lane)
                if job:
                    await run_job(job, db)
                    continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("job worker (%s) hit an error; continuing", lane)
        try:
            # A gated model lane looks again soon: the cool-down ends by the clock, not an event.
            await asyncio.wait_for(event.wait(), 0.5 if gated else IDLE_SECONDS)
        except TimeoutError:
            pass


def recover_interrupted(db: Session, *, resume: bool = True) -> int:
    """
    A job that was running when the process stopped goes back to the front of its lane
    once, to resume at its step (D11). Interrupted a second time, it fails and offers Retry
    rather than looping. A job the author had already stopped stays stopped. Called at
    startup. With `resume` off (Settings › Automatic work), every one is marked interrupted.
    """
    stuck = db.query(AIJob).filter(AIJob.status == "running").all()
    for job in stuck:
        if job.cancel_requested:
            job.status = "cancelled"
            job.finished_at = _now()
        elif not resume:
            job.status = "error"
            job.error = "Interrupted by a restart."
            job.step_label = None
            job.finished_at = _now()
        elif job.attempts < 1:
            job.attempts += 1
            job.cancel_requested = False
            _requeue_front(db, job, "Requeued after a restart")
        else:
            job.status = "error"
            job.error = "Interrupted by a restart twice."
            job.step_label = None
            job.finished_at = _now()
    if stuck:
        db.commit()
    return len(stuck)


def prune_quiet(db: Session, days: int = QUIET_RETENTION_DAYS) -> int:
    """Finished automatic work older than a month: nobody reads it, and it would bury the rest."""
    n = (
        db.query(AIJob)
        .filter(AIJob.quiet.is_(True), AIJob.status.in_(FINISHED), AIJob.finished_at < _now() - timedelta(days=days))
        .delete(synchronize_session=False)
    )
    db.commit()
    return n
