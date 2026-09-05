from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.setting import Setting
from ..models.story import Story
from ..models.user import User
from ..schemas.setting import SettingCreate, SettingOut, SettingUpdate

router = APIRouter()


def _verify_setting_access(setting_id: str, db: Session, user: User) -> Setting:
    setting = db.get(Setting, setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    story = db.query(Story).filter(Story.id == setting.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.get("/{setting_id}", response_model=SettingOut)
def get_setting(setting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_setting_access(setting_id, db, current_user)


@router.post("", response_model=SettingOut, status_code=status.HTTP_201_CREATED)
def create_setting(
    story_id: str,
    body: SettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    setting = Setting(story_id=story_id, **body.model_dump())
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.patch("/{setting_id}", response_model=SettingOut)
def update_setting(
    setting_id: str,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = _verify_setting_access(setting_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(setting, key, value)
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(setting_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    setting = _verify_setting_access(setting_id, db, current_user)
    db.delete(setting)
    db.commit()
