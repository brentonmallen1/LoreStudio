"""What each import did (doc 28): the record and report, read back. Nothing here writes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.import_record import ImportedItem, ImportRecord
from ..models.story import Story
from ..models.user import User
from ..services import import_records

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/imports")
def list_imports(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Every import that made or added to this story, newest first."""
    _story(story_id, db, user)
    records = (
        db.query(ImportRecord).filter(ImportRecord.story_id == story_id).order_by(ImportRecord.imported_at.desc()).all()
    )
    return [import_records.summary(r, db) for r in records]


@router.get("/stories/{story_id}/imports/{record_id}")
def get_import(story_id: str, record_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """One import's report: what came over, what waits, what had no place, the original file."""
    _story(story_id, db, user)
    record = db.get(ImportRecord, record_id)
    if record is None or record.story_id != story_id:
        raise HTTPException(status_code=404, detail="Import not found")
    items = db.query(ImportedItem).filter(ImportedItem.record_id == record.id).order_by(ImportedItem.position).all()
    return {
        **import_records.summary(record, db),
        "manifest": record.manifest or [],
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "origin_type": i.origin_type,
                "status": i.status,
                "became_type": i.became_type,
                "became_id": i.became_id,
            }
            for i in items
        ],
    }
