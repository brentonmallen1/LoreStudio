"""
Automatic work (doc 22): everything LoreStudio does by itself, in one list.

Most of it used to be invisible: the undo-history cap, the AI payload retention and the
quiet-job pruning ran at startup and told only the server log, and the database backup ran at
every start (every reload, in development) as well as once a day. Now each is a task here, with
what it does, when it runs, a switch and its options, and a record of its last run, and Settings ›
Automatic work draws the page from this table. One switch pauses them all.

Three kinds of task:

- **schedule**: the housekeeping (the database backup and three prunes). `automatic_loop` looks
  every few minutes for one whose last run is older than its interval and queues it as a quiet
  job on the local lane (doc 21: automatic work shows while it runs), owned by the first admin.
- **visit**: what an open story asks for (auto-backups, Numbers readings). The workspace calls
  `snapshots/check-auto`, which asks this module whether each may run and how.
- **start**: what happens when LoreStudio starts (resuming a job a restart cut off).

The settings are app-wide (`app_settings`), edited by an admin; the current values, and the
`.env` ones where there are any, are the defaults.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from ..config import settings as env
from ..models.ai_job import AIJob
from ..models.app_setting import AppSetting
from ..models.user import User
from .job_queue import ACTIVE, enqueue, handler

logger = logging.getLogger(__name__)

SETTINGS_KEY = "automatic"
STATE_KEY = "automatic_state"
#: How often the scheduler looks for a task that is due.
LOOK_SECONDS = 300
DAY = timedelta(days=1)

When = Literal["schedule", "visit", "start"]


def _plural(n: int, word: str) -> str:
    return f"{n:,} {word}" if n == 1 else f"{n:,} {word}s"


@dataclass(frozen=True)
class Option:
    """One setting of a task: a number with its unit and bounds, or a switch."""

    key: str
    label: str
    default: int | bool
    unit: str = ""
    min: int = 0
    max: int = 0

    @property
    def kind(self) -> str:
        return "switch" if isinstance(self.default, bool) else "number"


@dataclass(frozen=True)
class Task:
    id: str
    label: str
    #: What it does, in a sentence.
    description: str
    when: When
    #: When it runs, worded from its options: "Every 24 hours, keeping the last 14".
    cadence: Callable[[dict], str]
    options: tuple[Option, ...] = ()
    on: bool = True
    #: Scheduled tasks: the job that does the work, its label in Jobs, and how often it is due.
    job_kind: str | None = None
    job_label: str = ""
    every: Callable[[dict], timedelta] | None = None
    #: The Settings section with more of its settings, if any.
    link: str | None = None


def _readings_cadence(o: dict) -> str:
    parts = [f"when you open a story after {_plural(o['away_hours'], 'hour')} away"]
    if o["daily"]:
        parts.append("once a day if the book changed")
    if o["with_versions"]:
        parts.append("with each version you save")
    if o["after_restore"]:
        parts.append("after a restore")
    text = ", ".join(parts[:-1]) + (" and " if len(parts) > 1 else "") + parts[-1]
    return text[0].upper() + text[1:]


TASKS: tuple[Task, ...] = (
    Task(
        id="story-backups",
        label="Story auto-backups",
        description="Saves a version of the story you have open, if it changed, and thins the older "
        "auto-backups to the story's limits. Versions you name are never thinned.",
        when="visit",
        cadence=lambda o: (
            "While a story is open, at its backup interval: every 30 minutes unless "
            "you changed it under Backups or in the story's Versions"
        ),
        link="backups",
    ),
    Task(
        id="numbers-readings",
        label="Numbers readings",
        description="Measures the book (words, pacing, who is on the page) so Numbers can compare "
        "now with then. Local: spaCy, no model. Older readings thin to one a day after two weeks "
        "and one a week after three months; those taken with a version are kept.",
        when="visit",
        cadence=_readings_cadence,
        options=(
            Option("away_hours", "A new session after", 3, "hours", 1, 72),
            Option("daily", "Once a day if the book changed", True),
            Option("with_versions", "With each version you save", True),
            Option("after_restore", "After a restore", True),
        ),
    ),
    Task(
        id="db-backup",
        label="Database backup",
        description="Copies the whole database, every story and setting, to the backups folder, "
        "apart from story versions. Restore by replacing the database file.",
        when="schedule",
        on=env.db_backup_enabled,
        cadence=lambda o: f"Every {_plural(o['every_hours'], 'hour')}, keeping the last {o['keep']}",
        options=(
            Option("every_hours", "Every", 24, "hours", 1, 168),
            Option("keep", "Keep the last", env.db_backup_keep, "backups", 1, 365),
        ),
        job_kind="auto-db-backup",
        job_label="Backing up the database",
        every=lambda o: timedelta(hours=o["every_hours"]),
        link="backups",
    ),
    Task(
        id="prune-undo",
        label="Undo history",
        description="Keeps each story's undo history to a length: the oldest changes beyond it "
        "can no longer be undone. The prose's own history is the editor's and is not affected.",
        when="schedule",
        cadence=lambda o: f"Once a day, keeping the last {o['keep']:,} changes in each story",
        options=(Option("keep", "Keep the last", 10_000, "changes", 100, 1_000_000),),
        job_kind="auto-prune-undo",
        job_label="Trimming the undo history",
        every=lambda o: DAY,
    ),
    Task(
        id="prune-payloads",
        label="AI call records",
        description="Deletes what was sent to the model and what came back for old calls. The "
        "Chronicle keeps each call's line: when, which feature, how long, how many tokens.",
        when="schedule",
        on=env.ai_payload_retention_days > 0,
        cadence=lambda o: f"Once a day, deleting those older than {_plural(o['days'], 'day')}",
        options=(Option("days", "Older than", env.ai_payload_retention_days or 90, "days", 1, 3650),),
        job_kind="auto-prune-payloads",
        job_label="Deleting old AI call records",
        every=lambda o: DAY,
        link="privacy",
    ),
    Task(
        id="prune-jobs",
        label="Automatic job records",
        description="Forgets finished automatic jobs, like these and the Numbers readings, so the "
        "Jobs list and the Chronicle are not buried in them. Jobs you started are kept.",
        when="schedule",
        cadence=lambda o: f"Once a day, forgetting those older than {_plural(o['days'], 'day')}",
        options=(Option("days", "Older than", 30, "days", 1, 3650),),
        job_kind="auto-prune-jobs",
        job_label="Forgetting old automatic jobs",
        every=lambda o: DAY,
    ),
    Task(
        id="update-check",
        label="Check for updates",
        description="Asks GitHub whether a newer LoreStudio has been released, and says so in the "
        "logo menu and Settings › About. Nothing about you or your stories is sent; GitHub sees "
        "one request. Off unless you switch it on.",
        when="schedule",
        on=False,
        cadence=lambda o: "Once a day",
        job_kind="auto-update-check",
        job_label="Checking for a new LoreStudio",
        every=lambda o: DAY,
        link="about",
    ),
    Task(
        id="restart-recovery",
        label="Resume after a restart",
        description="A job a restart cut off goes back to the front of the queue, once, and carries "
        "on from its step. Off, it is marked interrupted, with Retry.",
        when="start",
        cadence=lambda o: "When LoreStudio starts",
    ),
)
TASKS_BY_ID = {t.id: t for t in TASKS}


# ── settings ──────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _read(db: Session, key: str) -> dict:
    row = db.get(AppSetting, key)
    return dict(row.value or {}) if row else {}


def _write(db: Session, key: str, value: dict) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value={})
        db.add(row)
    row.value = value
    db.commit()


def paused(db: Session) -> bool:
    return bool(_read(db, SETTINGS_KEY).get("paused", False))


def task_settings(db: Session, task_id: str) -> dict[str, Any]:
    """A task's switch and options: what was saved, else the defaults."""
    task = TASKS_BY_ID[task_id]
    saved = _read(db, SETTINGS_KEY).get("tasks", {}).get(task_id, {})
    out: dict[str, Any] = {"enabled": bool(saved.get("enabled", task.on))}
    for option in task.options:
        out[option.key] = saved.get(option.key, option.default)
    return out


def is_on(db: Session, task_id: str) -> bool:
    """Whether a task may run now: its own switch, and nothing paused."""
    return not paused(db) and task_settings(db, task_id)["enabled"]


def option(db: Session, task_id: str, key: str) -> Any:
    return task_settings(db, task_id)[key]


def reading_on(db: Session, key: str) -> bool:
    """A Numbers reading of one kind (with versions, after a restore) may be taken."""
    return is_on(db, "numbers-readings") and bool(option(db, "numbers-readings", key))


def update(db: Session, *, paused_: bool | None = None, tasks: dict[str, dict] | None = None) -> None:
    """Change the settings. Unknown tasks or options, or a number out of bounds, raise ValueError."""
    current = _read(db, SETTINGS_KEY)
    saved = dict(current.get("tasks", {}))
    for task_id, changes in (tasks or {}).items():
        task = TASKS_BY_ID.get(task_id)
        if task is None:
            raise ValueError(f"No automatic task called {task_id!r}.")
        options = {o.key: o for o in task.options}
        merged = dict(saved.get(task_id, {}))
        for key, value in changes.items():
            if key == "enabled":
                merged[key] = bool(value)
                continue
            spec = options.get(key)
            if spec is None:
                raise ValueError(f"{task.label} has no setting {key!r}.")
            if spec.kind == "switch":
                merged[key] = bool(value)
            elif isinstance(value, bool) or not isinstance(value, int) or not spec.min <= value <= spec.max:
                raise ValueError(f"{task.label}: {spec.label.lower()} must be {spec.min} to {spec.max:,}.")
            else:
                merged[key] = value
        saved[task_id] = merged
    value = {**current, "tasks": saved}
    if paused_ is not None:
        value["paused"] = paused_
    _write(db, SETTINGS_KEY, value)


# ── last runs ─────────────────────────────────────────────────────────────


def record_run(db: Session, task_id: str, summary: str, *, ok: bool = True) -> None:
    """What a task did, for the page's "last ran" (D6)."""
    state = _read(db, STATE_KEY)
    state[task_id] = {"at": _now().isoformat(), "summary": summary, "ok": ok}
    _write(db, STATE_KEY, state)


def last_run(db: Session, task_id: str) -> dict | None:
    run = _read(db, STATE_KEY).get(task_id)
    if task_id == "db-backup":
        # A backup on disk newer than the record (Back up now, or one from before this list
        # existed) is the last run as far as anyone can tell.
        from .db_backup import list_backups

        files = list_backups()
        if files and (run is None or files[0]["created_at"][:19] > run["at"][:19]):
            written = datetime.fromisoformat(files[0]["created_at"]).replace(tzinfo=None)
            return {"at": written.isoformat(), "summary": f"Wrote {files[0]['filename']}", "ok": True}
    return run


def _last_at(db: Session, task: Task) -> datetime | None:
    run = last_run(db, task.id)
    return datetime.fromisoformat(run["at"]) if run else None


def next_at(db: Session, task: Task, now: datetime | None = None) -> datetime | None:
    """When a scheduled task is next due (now, if it never ran), or None if it is off or not on
    a schedule."""
    if task.every is None or not is_on(db, task.id):
        return None
    last = _last_at(db, task)
    return (last + task.every(task_settings(db, task.id))) if last else (now or _now())


def _owner(db: Session) -> User | None:
    """Who the housekeeping jobs belong to: the first admin, else the first user."""
    return (
        db.query(User).filter(User.is_admin.is_(True)).order_by(User.created_at).first()
        or db.query(User).order_by(User.created_at).first()
    )


def queue_task(db: Session, task: Task, by: User | None = None) -> AIJob | None:
    """Queue a scheduled task's job: Run now `by` an admin, or the scheduler's, owned by the first
    admin. One at a time per task."""
    by_hand = by is not None
    owner = by or _owner(db)
    if owner is None or task.job_kind is None:
        return None
    return enqueue(
        db,
        kind=task.job_kind,
        user_id=owner.id,
        label=task.job_label,
        origin="author" if by_hand else "auto",
        origin_note=None if by_hand else "on its schedule",
        quiet=not by_hand,
    )


def schedule_due(db: Session, now: datetime | None = None) -> list[AIJob]:
    """Queue every scheduled task that is on and due. The scheduler's one look."""
    if paused(db):
        return []
    now = now or _now()
    queued = []
    for task in TASKS:
        if task.when != "schedule" or not is_on(db, task.id):
            continue
        due = next_at(db, task, now)
        if due is None or due > now:
            continue
        if db.query(AIJob).filter(AIJob.kind == task.job_kind, AIJob.status.in_(ACTIVE)).first():
            continue
        if job := queue_task(db, task):
            queued.append(job)
    return queued


async def automatic_loop(engine: Engine) -> None:
    """Look for due housekeeping every few minutes, forever. Cancelled with the app lifespan."""
    while True:
        try:
            with Session(engine) as db:
                schedule_due(db)
        except Exception:  # pragma: no cover - the scheduler must outlive any one failure
            logger.exception("automatic work: the scheduler's look failed")
        await asyncio.sleep(LOOK_SECONDS)


def at_start(db: Session) -> None:
    """What happens when LoreStudio starts: a job a restart cut off resumes, or is marked so."""
    from .job_queue import recover_interrupted

    resume = is_on(db, "restart-recovery")
    n = recover_interrupted(db, resume=resume)
    if not n:
        summary = "Nothing had been cut off"
    elif resume:
        summary = f"Put {_plural(n, 'job')} back in the queue"
    else:
        summary = f"Marked {_plural(n, 'job')} interrupted"
    record_run(db, "restart-recovery", summary)


# ── the housekeeping jobs ─────────────────────────────────────────────────


async def _recorded(db: Session, task_id: str, work: Callable[[], Awaitable[str]]) -> dict:
    """Run a task's work and record what it did, or that it failed."""
    try:
        summary = await work()
    except Exception as exc:
        db.rollback()
        record_run(db, task_id, f"Failed: {exc}", ok=False)
        raise
    record_run(db, task_id, summary)
    return {"summary": summary}


@handler("auto-db-backup", lane="local", quiet=True, unique=True)
async def _run_db_backup(job: AIJob, db: Session, user: User, report) -> dict:
    from .db_backup import create_backup

    async def work() -> str:
        keep = option(db, "db-backup", "keep")
        path = await asyncio.to_thread(create_backup, db.get_bind().engine, None, keep)
        if path is None:
            return "Skipped: the database is not a file"
        size = path.stat().st_size / (1024 * 1024)
        return f"Wrote {path.name} ({size:.1f} MB), keeping the last {keep}"

    return await _recorded(db, "db-backup", work)


@handler("auto-update-check", lane="local", quiet=True, unique=True)
async def _run_update_check(job: AIJob, db: Session, user: User, report) -> dict:
    from . import updates

    async def work() -> str:
        return updates.summary(await updates.check(db))

    return await _recorded(db, "update-check", work)


@handler("auto-prune-undo", lane="local", quiet=True, unique=True)
async def _run_prune_undo(job: AIJob, db: Session, user: User, report) -> dict:
    from .change_log import prune_all

    async def work() -> str:
        removed = prune_all(db, option(db, "prune-undo", "keep"))
        return f"Removed {_plural(removed, 'old change')}" if removed else "Nothing was over the limit"

    return await _recorded(db, "prune-undo", work)


@handler("auto-prune-payloads", lane="local", quiet=True, unique=True)
async def _run_prune_payloads(job: AIJob, db: Session, user: User, report) -> dict:
    from .ai_call_log import prune_payloads

    async def work() -> str:
        removed = prune_payloads(db, option(db, "prune-payloads", "days"))
        return f"Deleted {_plural(removed, 'old call record')}" if removed else "Nothing was old enough"

    return await _recorded(db, "prune-payloads", work)


@handler("auto-prune-jobs", lane="local", quiet=True, unique=True)
async def _run_prune_jobs(job: AIJob, db: Session, user: User, report) -> dict:
    from .job_queue import prune_quiet

    async def work() -> str:
        removed = prune_quiet(db, option(db, "prune-jobs", "days"))
        return f"Forgot {_plural(removed, 'old job')}" if removed else "Nothing was old enough"

    return await _recorded(db, "prune-jobs", work)
