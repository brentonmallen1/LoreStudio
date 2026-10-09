"""System status for Settings › System: version, database, backups."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..config import settings
from ..database import engine, get_db
from ..models.user import User
from ..services import automatic, updates
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
