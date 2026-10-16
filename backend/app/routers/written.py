"""What you've written (doc 29 D6): the Overview's discovery section and its tidy-up offers.

Reading writes nothing and asks no model. "Not now" on an offer is kept per story, as a change
⌘Z takes back.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.written import NotNowRequest, SplitOffer, WrittenOut
from ..services import change_log
from ..services.written import not_now, put_off, split_offer, written

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/written", response_model=WrittenOut)
def what_youve_written(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _story(story_id, db, user)
    return written(story_id, db)


@router.get("/structure/{node_id}/split-offer", response_model=SplitOffer | None)
def scene_split_offer(node_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The This scene tab's "Split it there?": a long scene where the time jumps, unless put off."""
    node = db.get(StructureNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    _story(node.story_id, db, user)
    if f"split:{node.id}" in put_off(node.story_id, db):
        return None
    return split_offer(node)


@router.post("/stories/{story_id}/written/not-now", status_code=status.HTTP_204_NO_CONTENT)
def offer_not_now(
    story_id: str,
    body: NotNowRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, user)
    if not not_now(story_id, body.key, db, actor_id=user.id, client_id=client_id):
        raise HTTPException(status_code=400, detail="There is no such offer to put off.")
    db.commit()
