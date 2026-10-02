"""The scratch pad (doc 15 N4): one page per author, belonging to no story."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.user import User

router = APIRouter()

MAX_HTML = 2_000_000


class ScratchPad(BaseModel):
    html: str


@router.get("/auth/me/scratch-pad", response_model=ScratchPad)
def get_scratch_pad(current_user: User = Depends(get_current_user)):
    return ScratchPad(html=current_user.scratch_pad or "")


@router.put("/auth/me/scratch-pad", response_model=ScratchPad)
def put_scratch_pad(body: ScratchPad, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if len(body.html) > MAX_HTML:
        raise HTTPException(status_code=413, detail="The scratch pad is too long to save")
    user = db.get(User, current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.scratch_pad = body.html
    db.commit()
    return ScratchPad(html=user.scratch_pad)
