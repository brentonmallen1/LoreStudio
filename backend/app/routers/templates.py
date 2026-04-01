from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models.structure import StoryStructureTemplate
from ..auth.dependencies import get_current_user

router = APIRouter()


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str
    levels: list

    model_config = {"from_attributes": True}


@router.get("/structures", response_model=list[TemplateOut])
def list_structure_templates(db: Session = Depends(get_db), _ = Depends(get_current_user)):
    return db.query(StoryStructureTemplate).all()
