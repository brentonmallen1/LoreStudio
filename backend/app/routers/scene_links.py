from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.scene_link import SceneLink
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.scene_link import SceneLinkCreate, SceneLinkOut, SceneLinkUpdate

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_link(link_id: str, db: Session, user: User) -> SceneLink:
    link = db.get(SceneLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="Scene link not found")
    _verify_story(link.story_id, db, user)
    return link


@router.get("/scene-links", response_model=list[SceneLinkOut])
def list_scene_links(
    story_id: str | None = None,
    node_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if story_id:
        _verify_story(story_id, db, current_user)
        return db.query(SceneLink).filter(SceneLink.story_id == story_id).all()
    if node_id:
        links = (
            db.query(SceneLink)
            .filter(or_(SceneLink.source_node_id == node_id, SceneLink.target_node_id == node_id))
            .all()
        )
        # Verify the user owns the stories for all returned links
        for link in links:
            _verify_story(link.story_id, db, current_user)
        return links
    raise HTTPException(status_code=400, detail="Either story_id or node_id query param is required")


@router.post("/scene-links", response_model=SceneLinkOut, status_code=status.HTTP_201_CREATED)
def create_scene_link(
    body: SceneLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(body.story_id, db, current_user)

    source = db.get(StructureNode, body.source_node_id)
    target = db.get(StructureNode, body.target_node_id)
    if not source or source.story_id != body.story_id:
        raise HTTPException(status_code=400, detail="source_node_id does not belong to this story")
    if not target or target.story_id != body.story_id:
        raise HTTPException(status_code=400, detail="target_node_id does not belong to this story")

    link = SceneLink(**body.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/scene-links/{link_id}", response_model=SceneLinkOut)
def update_scene_link(
    link_id: str,
    body: SceneLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = _verify_link(link_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(link, key, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/scene-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene_link(
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = _verify_link(link_id, db, current_user)
    db.delete(link)
    db.commit()
