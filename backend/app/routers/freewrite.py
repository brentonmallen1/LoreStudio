"""Freewrite (doc 15 N3): a page per story for thinking loosely.

Saved like prose: the editor's own history undoes keystrokes, so a save is not an undoable
change. What a sentence was made into (a note, a character) is, through its own route.
"""

import html as html_lib
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User

router = APIRouter()

#: A page of loose writing, not a manuscript: a ceiling keeps one paste from filling the database.
MAX_HTML = 2_000_000


class FreewriteIn(BaseModel):
    html: str


class FreewriteOut(BaseModel):
    html: str


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/freewrite", response_model=FreewriteOut)
def get_freewrite(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return FreewriteOut(html=_story(story_id, db, current_user).freewrite or "")


@router.put("/stories/{story_id}/freewrite", response_model=FreewriteOut)
def put_freewrite(
    story_id: str,
    body: FreewriteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.html) > MAX_HTML:
        raise HTTPException(status_code=413, detail="The page is too long to save")
    story = _story(story_id, db, current_user)
    story.freewrite = body.html
    db.commit()
    return FreewriteOut(html=story.freewrite)


class AppendIn(BaseModel):
    text: str
    #: Today's heading as the author's own calendar names it ("Friday 2 October").
    day: str


def append_to_page(page: str, text: str, day: str) -> str:
    """Add plain text to the end of a page, under day's heading (doc 15 N4).

    The heading is added only when the page's last one is another day. Blank lines in the
    text start new paragraphs; everything is escaped, so the text stays text.
    """
    headings = re.findall(r"<h3[^>]*>(.*?)</h3>", page, flags=re.S)
    last = re.sub(r"<[^>]+>", "", headings[-1]).strip() if headings else None
    out = page
    if last != day.strip():
        out += f"<h3>{html_lib.escape(day.strip())}</h3>"
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out += "".join(f"<p>{html_lib.escape(p)}</p>" for p in paragraphs)
    return out


@router.post("/stories/{story_id}/freewrite/append", response_model=FreewriteOut)
def append_freewrite(
    story_id: str,
    body: AppendIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The scratch pad's "Send to a story": the words go to the end of the story's page."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Nothing to send")
    story = _story(story_id, db, current_user)
    page = append_to_page(story.freewrite or "", body.text, body.day)
    if len(page) > MAX_HTML:
        raise HTTPException(status_code=413, detail="The page is too long to add to")
    story.freewrite = page
    db.commit()
    return FreewriteOut(html=story.freewrite)
