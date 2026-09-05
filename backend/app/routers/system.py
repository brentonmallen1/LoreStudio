"""System status for Settings › System: version, database, backups."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..config import settings
from ..database import engine, get_db
from ..models.user import User
from ..services.db_backup import backup_status, create_backup

router = APIRouter()

APP_VERSION = "0.1.0"


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    revision = None
    try:
        revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        revision = None
    return {
        "version": APP_VERSION,
        "env": settings.env,
        "database": {
            "backend": engine.url.get_backend_name(),
            "revision": revision,
            "foreign_keys": bool(db.execute(text("PRAGMA foreign_keys")).scalar()) if engine.url.get_backend_name() == "sqlite" else None,
        },
        "backups": backup_status(),
        "insecure_defaults": settings.insecure_defaults() if settings.is_dev else [],
    }


@router.post("/system/backups")
def run_backup_now(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    path = create_backup(engine)
    if path is None:
        raise HTTPException(status_code=400, detail="Backups are only supported for file-based SQLite databases")
    return backup_status()
