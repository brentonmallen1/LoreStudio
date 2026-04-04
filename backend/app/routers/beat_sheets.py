from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.beat_sheet import BeatSheet
from ..models.user import User
from ..schemas.beat_sheet import BeatSheetOut
from ..auth.dependencies import get_current_user

router = APIRouter()


@router.get("/beat-sheets", response_model=list[BeatSheetOut])
def list_beat_sheets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all system beat sheets plus the current user's custom ones."""
    return (
        db.query(BeatSheet)
        .filter(or_(BeatSheet.is_system == True, BeatSheet.user_id == current_user.id))  # noqa: E712
        .order_by(BeatSheet.is_system.desc(), BeatSheet.name)
        .all()
    )
