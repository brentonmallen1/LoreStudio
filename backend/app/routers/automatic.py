"""
Settings › Automatic work (doc 22): what LoreStudio does by itself, when, and the switches.

Read by anyone; changed by an admin, since the settings are this LoreStudio's, not one
author's. Run now queues a scheduled task at once, whether or not everything is paused: it is
the author's own button.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user, require_admin
from ..database import get_db
from ..models.user import User
from ..schemas.automatic import AutomaticOptionOut, AutomaticOut, AutomaticPatch, AutomaticTaskOut
from ..schemas.jobs import JobOut
from ..services import automatic

router = APIRouter()


def _out(db: Session, user: User) -> AutomaticOut:
    tasks = []
    for task in automatic.TASKS:
        values = automatic.task_settings(db, task.id)
        tasks.append(
            AutomaticTaskOut(
                id=task.id,
                label=task.label,
                description=task.description,
                when=task.when,
                enabled=values["enabled"],
                cadence=task.cadence(values),
                options=[
                    AutomaticOptionOut(
                        key=o.key,
                        label=o.label,
                        kind=o.kind,
                        unit=o.unit,
                        min=o.min,
                        max=o.max,
                        value=values[o.key],
                        default=o.default,
                    )
                    for o in task.options
                ],
                last_run=automatic.last_run(db, task.id),
                next_at=None if automatic.paused(db) else automatic.next_at(db, task),
                link=task.link,
                can_run_now=task.when == "schedule",
            )
        )
    return AutomaticOut(paused=automatic.paused(db), can_edit=user.is_admin, tasks=tasks)


@router.get("/automatic", response_model=AutomaticOut)
def get_automatic(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(db, user)


@router.patch("/automatic", response_model=AutomaticOut)
def update_automatic(body: AutomaticPatch, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        automatic.update(db, paused_=body.paused, tasks=body.tasks)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _out(db, user)


@router.post("/automatic/{task_id}/run", response_model=JobOut, status_code=201)
def run_now(task_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    task = automatic.TASKS_BY_ID.get(task_id)
    if task is None or task.when != "schedule":
        raise HTTPException(status_code=404, detail="No scheduled task by that name")
    job = automatic.queue_task(db, task, by=user)
    if job is None:
        raise HTTPException(status_code=409, detail="There is no user to run it as")
    return job
