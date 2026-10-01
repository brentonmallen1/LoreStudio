"""
The rail badge for the findings feed (doc 12 P3).

The Story Health dashboard this file used to serve is gone (doc 12 P4, P6): its findings
are the findings feed, its numbers are the Overview's (`GET /stories/{id}/overview`).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..services.findings import collect
from ..services.findings import data as finding_data
from ..services.findings.view import load_view

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/health/alerts")
def story_health_alerts(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The rail's badge: how many findings are open (doc 12 P3), so the badge and the
    feed always agree. The two older fields stay until the Findings page replaces Story
    Health."""
    story = _get_story(story_id, db, current_user)
    view = load_view(story, db)
    return {
        "count": collect(story, db).open_count,
        "absent_characters": [c.name for c, _ in finding_data.absent_characters(view)],
        "mice_violation_count": len(finding_data.mice_violations(view)),
    }
