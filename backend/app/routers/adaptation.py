"""
Adapt a novel as a screenplay or a stage play (doc 25, P10; services/adaptation.py).

GET what the script could start with (the novel's whole Lorebook, ticked), then POST to make it:
a new story in the novel's series with the novel's outline and the chosen Lorebook shared.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..schemas.series import CarryCandidate, CarryItem
from ..schemas.story import StoryCreated
from ..services.adaptation import TITLES, AdaptError, adapt, adapt_candidates, first_scene
from ..services.series import service
from ..services.series.kinds import FRONTEND_KIND
from ..services.story_format import StoryFormat

router = APIRouter()


class AdaptCreate(BaseModel):
    story_format: StoryFormat = "screenplay"
    #: Left empty, "<the novel>: The Screenplay" (or "…: A Play").
    title: str = ""
    carry: list[CarryItem] = []
    #: For the series a standalone novel starts; defaults to the novel's title.
    series_name: str | None = None


class AdaptationCreated(StoryCreated):
    series_id: str


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/adapt/carry", response_model=list[CarryCandidate])
def adapt_carry(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The novel's Lorebook, everything ticked: the script tells the same story."""
    story = _story(story_id, db, current_user)
    return [CarryCandidate(**c, lore_kind=FRONTEND_KIND.get(c["kind"], c["kind"])) for c in adapt_candidates(db, story)]


@router.post("/stories/{story_id}/adapt", response_model=AdaptationCreated, status_code=status.HTTP_201_CREATED)
def adapt_story(
    story_id: str,
    body: AdaptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The novel told as a script: a new story after it in its series, with its outline."""
    novel = _story(story_id, db, current_user)
    title = body.title.strip() or TITLES.get(body.story_format, "{title}").format(title=novel.title)
    try:
        story, series = adapt(
            db,
            novel,
            fmt=body.story_format,
            title=title,
            carry=[c.model_dump() for c in body.carry],
            series_name=body.series_name,
        )
    except (AdaptError, service.SeriesError) as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e
    db.commit()
    db.refresh(story)
    first = first_scene(db, story.id)
    created = StoryCreated.model_validate(story)
    return AdaptationCreated(**created.model_dump(), series_id=series.id).model_copy(
        update={"start_node_id": first.id if first else None}
    )
