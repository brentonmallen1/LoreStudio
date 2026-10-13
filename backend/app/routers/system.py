"""System status for Settings › System: version, database, backups; the example stories."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..config import settings
from ..database import engine, get_db
from ..models.user import User
from ..services import automatic, examples, tutorial, updates
from ..services.db_backup import backup_status, create_backup

router = APIRouter()


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    revision = None
    try:
        revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        revision = None
    return {
        "version": settings.app_version,
        "env": settings.env,
        "database": {
            "backend": engine.url.get_backend_name(),
            "revision": revision,
            "foreign_keys": bool(db.execute(text("PRAGMA foreign_keys")).scalar())
            if engine.url.get_backend_name() == "sqlite"
            else None,
        },
        "backups": {
            **backup_status(),
            # When it runs is Settings › Automatic work's (doc 22).
            "enabled": automatic.is_on(db, "db-backup"),
            "keep": automatic.option(db, "db-backup", "keep"),
            "every_hours": automatic.option(db, "db-backup", "every_hours"),
        },
        "insecure_defaults": settings.insecure_defaults() if settings.is_dev else [],
    }


@router.get("/system/update")
def update_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The version running, the latest release last seen, and how to update (Settings › About)."""
    return updates.status(db)


@router.post("/system/update/check")
async def check_for_update(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check now, whether or not the daily check is on: the author asked."""
    found = await updates.check(db)
    automatic.record_run(db, "update-check", updates.summary(found), ok=not found["error"])
    return found


@router.post("/system/backups")
def run_backup_now(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    path = create_backup(engine, keep=automatic.option(db, "db-backup", "keep"))
    if path is None:
        raise HTTPException(status_code=400, detail="Backups are only supported for file-based SQLite databases")
    automatic.record_run(db, "db-backup", f"Wrote {path.name} (Back up now)")
    return {
        **backup_status(),
        "enabled": automatic.is_on(db, "db-backup"),
        "keep": automatic.option(db, "db-backup", "keep"),
    }


def _samples(db: Session, user: User) -> dict:
    return {"available": True, "missing": examples.missing(db, user), "samples": examples.listing(db, user)}


@router.get("/system/examples")
def example_stories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every sample, and which this account does not have yet (doc 26, P7: every account can
    load them, one at a time or all)."""
    return _samples(db, current_user)


class SampleChoice(BaseModel):
    #: The samples to load; none named, every one missing.
    titles: list[str] | None = None


@router.post("/system/examples")
def add_example_stories(
    body: SampleChoice | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Load the chosen samples, or every one this account does not have yet (Getting started,
    Settings › Account)."""
    titles = body.titles if body else None
    unknown = sorted(set(titles or ()) - set(examples.TITLES))
    if unknown:
        raise HTTPException(status_code=400, detail=f"No sample called “{unknown[0]}”.")
    added = examples.add_missing(db, current_user, titles)
    return {"added": added, **_samples(db, current_user)}


@router.post("/system/tutorial")
def ensure_tutorial(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The tutorial stories, made the first time an account signs in (doc 26, P6); the app asks
    once it has signed in. The titles made, none after the first time."""
    return {"made": tutorial.ensure(db, current_user)}


class TutorialRestart(BaseModel):
    kind: Literal["prose", "screenplay"]


@router.post("/system/tutorial/restart")
def restart_tutorial(
    body: TutorialRestart, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """A fresh copy of one tutorial story (Guides › Start the tutorial again)."""
    story = tutorial.restart(db, current_user, body.kind)
    return {"story_id": story.id, "title": story.title}
