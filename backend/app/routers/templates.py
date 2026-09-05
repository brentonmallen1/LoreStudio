from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models.structure import StoryStructureTemplate
from ..models.user import User
from ..auth.dependencies import get_current_user

router = APIRouter()


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str
    levels: list
    is_system: bool
    user_id: str | None = None

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    levels: list  # [{"name": "Act", "plural": "Acts"}, ...]


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    levels: list | None = None


@router.get("/structures", response_model=list[TemplateOut])
def list_structure_templates(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return (
        db.query(StoryStructureTemplate)
        .filter(
            (StoryStructureTemplate.is_system.is_(True)) |
            (StoryStructureTemplate.user_id == current_user.id)
        )
        .all()
    )


@router.post("/structures", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.levels or len(body.levels) < 1:
        raise HTTPException(status_code=400, detail="At least one level is required")
    template = StoryStructureTemplate(
        name=body.name,
        description=body.description,
        levels=body.levels,
        is_system=False,
        user_id=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.patch("/structures/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: str,
    body: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.get(StoryStructureTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_system:
        raise HTTPException(status_code=403, detail="Cannot modify system templates")
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/structures/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    template = db.get(StoryStructureTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system templates")
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(template)
    db.commit()
