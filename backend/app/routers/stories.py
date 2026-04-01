from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.story import StoryCreate, StoryUpdate, StoryOut
from ..schemas.structure import StructureNodeCreate, StructureNodeOut
from ..auth.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=list[StoryOut])
def list_stories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Story).filter(Story.user_id == current_user.id).order_by(Story.updated_at.desc()).all()


@router.post("", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
def create_story(body: StoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = Story(user_id=current_user.id, **body.model_dump())
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


@router.get("/{story_id}", response_model=StoryOut)
def get_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.patch("/{story_id}", response_model=StoryOut)
def update_story(
    story_id: str,
    body: StoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(story, key, value)
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(story)
    db.commit()


@router.get("/{story_id}/structure", response_model=list[StructureNodeOut])
def get_story_structure(
    story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    roots = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story_id, StructureNode.parent_id == None)
        .order_by(StructureNode.position)
        .all()
    )
    return roots


@router.post("/{story_id}/structure", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def create_structure_node(
    story_id: str,
    body: StructureNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    node = StructureNode(story_id=story_id, **body.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.get("/{story_id}/characters")
def list_characters(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.character import Character
    from ..schemas.character import CharacterOut
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    characters = db.query(Character).filter(Character.story_id == story_id).order_by(Character.name).all()
    return [CharacterOut.model_validate(c) for c in characters]


@router.post("/{story_id}/characters", status_code=status.HTTP_201_CREATED)
def create_character(
    story_id: str,
    body,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.character import Character
    from ..schemas.character import CharacterCreate, CharacterOut
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    character = Character(story_id=story_id, **body.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return CharacterOut.model_validate(character)


@router.get("/{story_id}/settings")
def list_settings(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.setting import Setting
    from ..schemas.setting import SettingOut
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    settings = db.query(Setting).filter(Setting.story_id == story_id).order_by(Setting.name).all()
    return [SettingOut.model_validate(s) for s in settings]
