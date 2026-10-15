"""Deleting a story, the one way every route does it (DELETE /stories/{id}, and a series
deleted with its books). Flushes, never commits: the caller owns the transaction."""

from sqlalchemy.orm import Session

from ..models.story import Story
from .series import service as series_service


def delete_story(db: Session, story: Story) -> None:
    """The story and every row it owns (ORM cascades). Out of its series first, so elements
    only it had and an emptied series go too."""
    series_service.detach_story(db, story.id)
    db.delete(story)
    db.flush()
