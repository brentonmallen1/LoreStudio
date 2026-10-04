from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.diagram import Diagram
from ..models.story import Story
from ..models.user import User
from ..schemas.diagram import DiagramCreate, DiagramOut, DiagramSummary, DiagramUpdate
from ..services import change_log
from ..services.series import sync as series_sync

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_diagram_access(diagram_id: str, db: Session, user: User) -> Diagram:
    diagram = db.get(Diagram, diagram_id)
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    _verify_story_access(diagram.story_id, db, user)
    return diagram


@router.post("/stories/{story_id}/diagrams", response_model=DiagramOut, status_code=status.HTTP_201_CREATED)
def create_diagram(
    story_id: str,
    body: DiagramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = _verify_story_access(story_id, db, current_user)
    diagram = Diagram(story_id=story.id, **body.model_dump())
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    return diagram


@router.get("/stories/{story_id}/diagrams", response_model=list[DiagramSummary])
def list_diagrams(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return db.query(Diagram).filter(Diagram.story_id == story_id).order_by(Diagram.updated_at.desc()).all()


@router.get("/diagrams/{diagram_id}", response_model=DiagramOut)
def get_diagram(
    diagram_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_diagram_access(diagram_id, db, current_user)


@router.patch("/diagrams/{diagram_id}", response_model=DiagramOut)
def update_diagram(
    diagram_id: str,
    body: DiagramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    diagram = _verify_diagram_access(diagram_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        diagram,
        data,
        entity_type="diagram",
        story_id=diagram.story_id,
        label=f"Edit {{fields}} on “{diagram.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(diagram, key, value)
    # Shared with its series: every book's copy follows.
    series_sync.after_write(db, "diagrams", diagram, list(data), actor_id=current_user.id, client_id=client_id)
    db.commit()
    db.refresh(diagram)
    return diagram


@router.delete("/diagrams/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram(
    diagram_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    diagram = _verify_diagram_access(diagram_id, db, current_user)
    db.delete(diagram)
    db.commit()
