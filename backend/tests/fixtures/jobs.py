"""Run what a request queued, as the lane's worker would (doc 21): tests have no worker."""

import anyio
from sqlalchemy.orm import Session

from app.models.ai_job import AIJob
from app.services.job_queue import _claim_next, run_job


def run_queued(db: Session, lane: str = "local") -> list[AIJob]:
    """Every job queued in the lane, run to the end in order."""
    ran = []
    while (job := _claim_next(db, lane)) is not None:
        anyio.run(run_job, job, db)
        db.refresh(job)
        ran.append(job)
    return ran
