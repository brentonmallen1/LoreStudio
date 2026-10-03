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
from ..services import change_log
from ..services.structure_order import reading_order

router = APIRouter()


def _orient(link: SceneLink, db: Session) -> None:
    """A callback points back, foreshadowing points ahead (doc 18): a link drawn the other way
    round is turned, so "calls back to" never names a later scene."""
    order = reading_order(link.story_id, db)
    src, dst = order.get(link.source_node_id, 0), order.get(link.target_node_id, 0)
    if (link.link_type == "callback" and dst > src) or (link.link_type == "foreshadowing" and dst < src):
        link.source_node_id, link.target_node_id = link.target_node_id, link.source_node_id


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
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(body.story_id, db, current_user)

    source = db.get(StructureNode, body.source_node_id)
    target = db.get(StructureNode, body.target_node_id)
    if not source or source.story_id != body.story_id:
        raise HTTPException(status_code=400, detail="source_node_id does not belong to this story")
    if not target or target.story_id != body.story_id:
        raise HTTPException(status_code=400, detail="target_node_id does not belong to this story")

    link = SceneLink(**body.model_dump())
    _orient(link, db)
    db.add(link)
    db.flush()
    change_log.record_row_create(
        db,
        link,
        "scene_links",
        entity_type="scene_link",
        story_id=link.story_id,
        label=f"Link scenes ({link.link_type})",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(link)
    return link


@router.patch("/scene-links/{link_id}", response_model=SceneLinkOut)
def update_scene_link(
    link_id: str,
    body: SceneLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    link = _verify_link(link_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    if "link_type" in data:
        probe = SceneLink(**{**{c: getattr(link, c) for c in ("story_id", "source_node_id", "target_node_id")}, **data})
        _orient(probe, db)
        data["source_node_id"], data["target_node_id"] = probe.source_node_id, probe.target_node_id
    change_log.record_update(
        db,
        link,
        data,
        entity_type="scene_link",
        story_id=link.story_id,
        label="Edit {fields} on a scene link",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(link, key, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/scene-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene_link(
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    link = _verify_link(link_id, db, current_user)
    change_log.record_row_delete(
        db,
        link,
        "scene_links",
        entity_type="scene_link",
        story_id=link.story_id,
        label=f"Remove a scene link ({link.link_type})",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(link)
    db.commit()
