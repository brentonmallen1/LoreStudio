from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.beat_sheet import BeatSheet
from ..models.user import User
from ..schemas.beat_sheet import BeatSheetOut, BeatSheetCreate, BeatSheetUpdate
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


@router.post("/beat-sheets", response_model=BeatSheetOut, status_code=201)
def create_beat_sheet(
    body: BeatSheetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sheet = BeatSheet(
        name=body.name,
        description=body.description,
        is_system=False,
        user_id=current_user.id,
        beats=[b.model_dump() for b in body.beats],
    )
    db.add(sheet)
    db.commit()
    db.refresh(sheet)
    return sheet


@router.put("/beat-sheets/{sheet_id}", response_model=BeatSheetOut)
def update_beat_sheet(
    sheet_id: str,
    body: BeatSheetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sheet = db.query(BeatSheet).filter(BeatSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Beat sheet not found")
    if sheet.is_system or sheet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit this beat sheet")
    if body.name is not None:
        sheet.name = body.name
    if body.description is not None:
        sheet.description = body.description
    if body.beats is not None:
        sheet.beats = [b.model_dump() for b in body.beats]
    db.commit()
    db.refresh(sheet)
    return sheet


@router.delete("/beat-sheets/{sheet_id}", status_code=204)
def delete_beat_sheet(
    sheet_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sheet = db.query(BeatSheet).filter(BeatSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Beat sheet not found")
    if sheet.is_system or sheet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete this beat sheet")
    db.delete(sheet)
    db.commit()
