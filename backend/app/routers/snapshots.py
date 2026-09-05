"""Snapshots & backup settings router."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.snapshot import StoryBackupSettings, StorySnapshot, UserBackupDefaults
from ..models.story import Story
from ..models.user import User
from ..services.snapshot_service import (
    _delete_snapshot_from_disk,
    _get_or_create_settings,
    create_snapshot,
    diff_snapshots,
    export_snapshot,
    get_backup_status,
    import_snapshot_file,
    restore_snapshot,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_snapshot_access(snapshot_id: str, story_id: str, db: Session) -> StorySnapshot:
    snap = (
        db.query(StorySnapshot)
        .filter(
            StorySnapshot.id == snapshot_id,
            StorySnapshot.story_id == story_id,
        )
        .first()
    )
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snap


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SnapshotOut(BaseModel):
    id: str
    story_id: str
    name: str | None
    trigger: str
    snapshot_type: str
    base_snapshot_id: str | None
    summary: dict | None
    delta_summary: dict | None
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_snap(cls, snap: StorySnapshot) -> "SnapshotOut":
        created = snap.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        return cls(
            id=snap.id,
            story_id=snap.story_id,
            name=snap.name,
            trigger=snap.trigger,
            snapshot_type=snap.snapshot_type,
            base_snapshot_id=snap.base_snapshot_id,
            summary=snap.summary,
            delta_summary=snap.delta_summary,
            created_at=created.isoformat(),
        )


class CreateSnapshotBody(BaseModel):
    name: str | None = None


class RenameSnapshotBody(BaseModel):
    name: str | None = None


class RestoreBody(BaseModel):
    create_safety_backup: bool = True


class BackupSettingsOut(BaseModel):
    id: str
    story_id: str
    auto_enabled: bool
    interval_minutes: int
    max_count: int | None
    max_age_days: int | None
    last_auto_backup_at: str | None
    include_diagrams: bool
    include_interviews: bool
    include_chat_sessions: bool
    include_activity_logs: bool
    activity_log_limit: int | None
    include_media_assets: bool

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_settings(cls, s: StoryBackupSettings) -> "BackupSettingsOut":
        last = s.last_auto_backup_at
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        return cls(
            id=s.id,
            story_id=s.story_id,
            auto_enabled=s.auto_enabled,
            interval_minutes=s.interval_minutes,
            max_count=s.max_count,
            max_age_days=s.max_age_days,
            last_auto_backup_at=last.isoformat() if last else None,
            include_diagrams=s.include_diagrams,
            include_interviews=s.include_interviews,
            include_chat_sessions=s.include_chat_sessions,
            include_activity_logs=s.include_activity_logs,
            activity_log_limit=s.activity_log_limit,
            include_media_assets=s.include_media_assets,
        )


class BackupSettingsUpdate(BaseModel):
    auto_enabled: bool | None = None
    interval_minutes: int | None = None
    max_count: int | None = None
    max_age_days: int | None = None
    include_diagrams: bool | None = None
    include_interviews: bool | None = None
    include_chat_sessions: bool | None = None
    include_activity_logs: bool | None = None
    activity_log_limit: int | None = None
    include_media_assets: bool | None = None


class UserBackupDefaultsOut(BaseModel):
    id: str
    user_id: str
    auto_enabled: bool
    interval_minutes: int
    max_count: int | None
    max_age_days: int | None
    include_diagrams: bool
    include_interviews: bool
    include_chat_sessions: bool
    include_activity_logs: bool
    activity_log_limit: int | None
    include_media_assets: bool

    model_config = {"from_attributes": True}


class UserBackupDefaultsUpdate(BaseModel):
    auto_enabled: bool | None = None
    interval_minutes: int | None = None
    max_count: int | None = None
    max_age_days: int | None = None
    include_diagrams: bool | None = None
    include_interviews: bool | None = None
    include_chat_sessions: bool | None = None
    include_activity_logs: bool | None = None
    activity_log_limit: int | None = None
    include_media_assets: bool | None = None


# ---------------------------------------------------------------------------
# Snapshot CRUD
# ---------------------------------------------------------------------------


@router.post("/stories/{story_id}/snapshots", response_model=SnapshotOut)
def create_manual_snapshot(
    story_id: str,
    body: CreateSnapshotBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    # A manual snapshot is always written, even when nothing changed since the anchor.
    snap = create_snapshot(story_id, db, trigger="manual", name=body.name, force=True)
    if snap is None:
        raise HTTPException(status_code=500, detail="Snapshot was not created")
    return SnapshotOut.from_orm_snap(snap)


@router.get("/stories/{story_id}/snapshots", response_model=list[SnapshotOut])
def list_snapshots(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snaps = (
        db.query(StorySnapshot)
        .filter(StorySnapshot.story_id == story_id)
        .order_by(StorySnapshot.created_at.desc())
        .all()
    )
    return [SnapshotOut.from_orm_snap(s) for s in snaps]


@router.get("/stories/{story_id}/snapshots/status")
def get_status(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return get_backup_status(story_id, db)


@router.post("/stories/{story_id}/snapshots/check-auto")
def check_auto_backup(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called on story load and on a timer. Creates an auto-backup if the interval has elapsed."""
    _verify_story_access(story_id, db, current_user)
    settings = _get_or_create_settings(story_id, db)

    if not settings.auto_enabled:
        return {"created": False}

    now = datetime.now(UTC)
    last = settings.last_auto_backup_at
    if last:
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        elapsed_minutes = (now - last).total_seconds() / 60
        if elapsed_minutes < settings.interval_minutes:
            return {"created": False}

    snap = create_snapshot(story_id, db, trigger="auto", settings=settings)
    if snap is None:
        return {"created": False, "reason": "no_changes"}
    return {"created": True, "snapshot": SnapshotOut.from_orm_snap(snap)}


@router.get("/stories/{story_id}/snapshots/diff")
def compare_snapshots(
    story_id: str,
    a_id: str = Query(...),
    b_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap_a = _verify_snapshot_access(a_id, story_id, db)
    snap_b = _verify_snapshot_access(b_id, story_id, db)
    return diff_snapshots(snap_a, snap_b, db)


@router.get("/stories/{story_id}/snapshots/{snapshot_id}", response_model=SnapshotOut)
def get_snapshot(
    story_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap = _verify_snapshot_access(snapshot_id, story_id, db)
    return SnapshotOut.from_orm_snap(snap)


@router.patch("/stories/{story_id}/snapshots/{snapshot_id}", response_model=SnapshotOut)
def rename_snapshot(
    story_id: str,
    snapshot_id: str,
    body: RenameSnapshotBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap = _verify_snapshot_access(snapshot_id, story_id, db)
    snap.name = body.name
    db.commit()
    db.refresh(snap)
    return SnapshotOut.from_orm_snap(snap)


@router.delete("/stories/{story_id}/snapshots/{snapshot_id}", status_code=204)
def delete_snapshot(
    story_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap = _verify_snapshot_access(snapshot_id, story_id, db)
    db.delete(snap)
    db.commit()
    _delete_snapshot_from_disk(story_id, snapshot_id)


@router.post("/stories/{story_id}/snapshots/{snapshot_id}/restore")
def restore_to_snapshot(
    story_id: str,
    snapshot_id: str,
    body: RestoreBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap = _verify_snapshot_access(snapshot_id, story_id, db)
    restore_snapshot(snap, db, create_safety_backup=body.create_safety_backup)
    return {"restored": True, "snapshot_id": snapshot_id}


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------


@router.get("/stories/{story_id}/snapshots/{snapshot_id}/export")
def export_snapshot_file(
    story_id: str,
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    snap = _verify_snapshot_access(snapshot_id, story_id, db)
    data = export_snapshot(snap, db)
    story = db.query(Story).filter(Story.id == story_id).first()
    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in (story.title if story else "story"))
    date_str = snap.created_at.strftime("%Y-%m-%d")
    filename = f"{safe_title}-{date_str}.lorestudio.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/stories/{story_id}/snapshots/import")
async def import_into_story(
    story_id: str,
    file: UploadFile = File(...),
    create_safety_backup: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a .lorestudio.zip and restore it into an existing story."""
    _verify_story_access(story_id, db, current_user)
    contents = await file.read()
    try:
        parsed = import_snapshot_file(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    state = parsed["state"]
    # Force the state to use the target story's ID
    if "story" in state:
        state["story"]["id"] = story_id

    if create_safety_backup:
        settings = _get_or_create_settings(story_id, db)
        create_snapshot(story_id, db, trigger="auto", name="Pre-import backup", settings=settings, force=True)

    from ..services.snapshot_service import _delete_story_content, _insert_story_content

    _delete_story_content(story_id, db)
    _insert_story_content(state, db)
    db.commit()
    return {"imported": True, "manifest": parsed["manifest"]}


@router.post("/stories/import")
async def import_as_new_story(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a .lorestudio.zip as a brand-new story."""
    import uuid

    contents = await file.read()
    try:
        parsed = import_snapshot_file(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    state = parsed["state"]
    new_story_id = str(uuid.uuid4())

    # Remap all story_id references to the new ID
    old_story_id = state.get("story", {}).get("id")
    state_str = __import__("json").dumps(state)
    if old_story_id:
        state_str = state_str.replace(old_story_id, new_story_id)
    state = __import__("json").loads(state_str)
    state["story"]["id"] = new_story_id
    state["story"]["user_id"] = current_user.id

    from ..models.story import Story as StoryModel
    from ..services.snapshot_service import _insert_story_content

    new_story = StoryModel(
        id=new_story_id,
        user_id=current_user.id,
        title=state["story"].get("title", "Imported Story"),
    )
    db.add(new_story)
    db.flush()
    _insert_story_content(state, db)
    db.commit()
    return {"imported": True, "story_id": new_story_id, "manifest": parsed["manifest"]}


# ---------------------------------------------------------------------------
# Per-story backup settings
# ---------------------------------------------------------------------------


@router.get("/stories/{story_id}/backup-settings", response_model=BackupSettingsOut)
def get_backup_settings(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    settings = _get_or_create_settings(story_id, db)
    db.commit()
    return BackupSettingsOut.from_orm_settings(settings)


@router.put("/stories/{story_id}/backup-settings", response_model=BackupSettingsOut)
def update_backup_settings(
    story_id: str,
    body: BackupSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    settings = _get_or_create_settings(story_id, db)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return BackupSettingsOut.from_orm_settings(settings)


# ---------------------------------------------------------------------------
# Global user backup defaults
# ---------------------------------------------------------------------------


@router.get("/user/backup-defaults", response_model=UserBackupDefaultsOut)
def get_user_backup_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    defaults = db.query(UserBackupDefaults).filter(UserBackupDefaults.user_id == current_user.id).first()
    if not defaults:
        defaults = UserBackupDefaults(user_id=current_user.id)
        db.add(defaults)
        db.commit()
        db.refresh(defaults)
    return defaults


@router.put("/user/backup-defaults", response_model=UserBackupDefaultsOut)
def update_user_backup_defaults(
    body: UserBackupDefaultsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    defaults = db.query(UserBackupDefaults).filter(UserBackupDefaults.user_id == current_user.id).first()
    if not defaults:
        defaults = UserBackupDefaults(user_id=current_user.id)
        db.add(defaults)
        db.flush()
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(defaults, key, value)
    db.commit()
    db.refresh(defaults)
    return defaults
