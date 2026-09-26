"""
Chronicle › Activity: one timeline of what the system did (refactor doc 06 §3, §8).

Jobs and the calls they made used to live in two tabs that did not know about each other:
a job said it was done, and its calls sat somewhere in a separate list with no way to get
from one to the other. Here a job is a row of its own and the calls it made belong to it,
so the unfiltered timeline shows each piece of work once.

Filtering changes that on purpose. Asking for problems, starred rows or results is asking
for specific calls, and a failed call inside a job that otherwise finished is exactly
what "problems" should find — so a filtered timeline lists matching calls flat, each one
still carrying the id of the job it came from.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from ..models.activity_log import ActivityLog
from ..models.ai_job import AIJob

#: Features whose output is worth keeping: summaries, analyses, brainstorms. The
#: "Results" filter, which replaced the Summaries tab.
RESULT_FEATURES = [
    "story-summary",
    "scene-summary",
    "scene-summary-batch",
    "structure-summary",
    "interview-summary",
    "character-journey",
    "perspective-summary",
    "economy-analysis",
    "story-recap",
    "brainstorm",
]

PROBLEM_JOB_STATUSES = ["error", "cancelled"]


@dataclass
class TimelineFilters:
    story_id: str | None = None
    problems: bool = False
    starred: bool = False
    results: bool = False
    #: Writer mode: nothing AI-made — no AI calls, no jobs.
    exclude_ai: bool = False
    text: str | None = None

    @property
    def nested(self) -> bool:
        """Calls sit inside their jobs only when nothing narrows the list."""
        return not (self.problems or self.starred or self.results)


@dataclass
class TimelineEntry:
    at: datetime
    log: ActivityLog | None = None
    job: AIJob | None = None
    #: For a job: how many AI calls it made.
    call_count: int = 0


def _job_id_of():
    return ActivityLog.metadata_["job_id"].as_string()


def _logs(db: Session, user_id: str, f: TimelineFilters) -> Query:
    q = db.query(ActivityLog).filter(ActivityLog.user_id == user_id)
    if f.story_id:
        q = q.filter(ActivityLog.story_id == f.story_id)
    if f.exclude_ai:
        q = q.filter(ActivityLog.category != "ai")
    if f.nested:
        q = q.filter(_job_id_of().is_(None))
    if f.problems:
        # A row with no status predates statuses and succeeded; NULL is correctly excluded.
        q = q.filter(ActivityLog.metadata_["status"].as_string().notin_(["ok"]))
    if f.starred:
        q = q.filter(ActivityLog.starred.is_(True))
    if f.results:
        q = q.filter(ActivityLog.metadata_["feature"].as_string().in_(RESULT_FEATURES))
    if f.text:
        q = q.filter(ActivityLog.description.ilike(f"%{f.text}%"))
    return q


def _jobs(db: Session, user_id: str, f: TimelineFilters) -> Query | None:
    """Jobs appear unfiltered, or as problems when they failed or were stopped."""
    if f.exclude_ai or f.starred or f.results:
        return None
    q = db.query(AIJob).filter(AIJob.user_id == user_id)
    if f.story_id:
        q = q.filter(AIJob.story_id == f.story_id)
    if f.problems:
        q = q.filter(AIJob.status.in_(PROBLEM_JOB_STATUSES))
    if f.text:
        q = q.filter(or_(AIJob.label.ilike(f"%{f.text}%"), AIJob.error.ilike(f"%{f.text}%")))
    return q


def call_counts(db: Session, job_ids: list[str]) -> dict[str, int]:
    """How many AI calls each job made (not the summary rows it also writes)."""
    if not job_ids:
        return {}
    job_id = _job_id_of()
    rows = (
        db.query(job_id, func.count()).filter(job_id.in_(job_ids), ActivityLog.category == "ai").group_by(job_id).all()
    )
    return {jid: n for jid, n in rows}


def timeline(
    db: Session, user_id: str, filters: TimelineFilters, *, page: int = 1, page_size: int = 50
) -> tuple[list[TimelineEntry], int]:
    """
    One page of the merged timeline, newest first, and the total across both sources.

    Offset pagination over two tables: take the first `offset + page_size` of each, merge,
    and slice. Anything that could land on this page is inside that window from one side
    or the other, so the order is exact.
    """
    window = page * page_size
    logs_q = _logs(db, user_id, filters)
    jobs_q = _jobs(db, user_id, filters)

    entries = [
        TimelineEntry(at=log.created_at, log=log)
        for log in logs_q.order_by(ActivityLog.created_at.desc()).limit(window).all()
    ]
    total = logs_q.count()
    if jobs_q is not None:
        jobs = jobs_q.order_by(AIJob.created_at.desc()).limit(window).all()
        entries += [TimelineEntry(at=job.created_at, job=job) for job in jobs]
        total += jobs_q.count()

    entries.sort(key=lambda e: e.at, reverse=True)
    page_entries = entries[(page - 1) * page_size : window]

    counts = call_counts(db, [e.job.id for e in page_entries if e.job])
    for e in page_entries:
        if e.job:
            e.call_count = counts.get(e.job.id, 0)
    return page_entries, total


def job_activity(db: Session, job_id: str) -> list[ActivityLog]:
    """Everything a job wrote to the activity log, in the order it happened."""
    return db.query(ActivityLog).filter(_job_id_of() == job_id).order_by(ActivityLog.created_at).all()
