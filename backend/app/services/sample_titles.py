"""
The sample stories' titles (doc 26, P7): "Sample: Kind · Title", so a library says which stories
are samples and what each shows (Brenton, 2026-10-13). Kept apart from the seeds so they can
name each other (the screenplay is told from the novel, the sequel carries on from it) without
importing each other.

An install seeded before the samples were named holds them under their old titles: `OLD` maps
each new title to that, so such a library is not offered the same sample twice.
"""

from sqlalchemy.orm import Session

from ..config import settings
from ..models.story import Story
from ..models.user import User

NOVEL = "Sample: Novel · The Last Lighthouse"
SCREENPLAY = "Sample: Screenplay · The Last Lighthouse"
STAGE_PLAY = "Sample: Stage play · The Last Lighthouse"
SCIFI = "Sample: Novel · The Last Signal"
FLASH = "Sample: Flash fiction · The Weight of Keys"
SHORT = "Sample: Short story · The Audition"
FIRST_PERSON = "Sample: First person · Sixty Minutes"
SERIES = "Sample: Series · The Keeper's Daughter"
#: The series' third book, planned and not yet written; made with the sequel.
SERIES_PLANNED = "Sample: Series · After the Light"

OLD = {
    NOVEL: "The Last Lighthouse",
    SCREENPLAY: "The Last Lighthouse: The Screenplay",
    STAGE_PLAY: "The Last Lighthouse: A Play in One Act",
    SCIFI: "The Last Signal",
    FLASH: "The Weight of Keys",
    SHORT: "The Audition",
    FIRST_PERSON: "Sixty Minutes",
    SERIES: "The Keeper's Daughter",
    SERIES_PLANNED: "After the Light",
}

#: Every title a sample has had, new and old.
ALL = frozenset(OLD) | frozenset(OLD.values())


def owner(db: Session, user_id: str | None) -> User | None:
    """The account a sample goes to: the one asking, or the admin the app made (first start)."""
    if user_id:
        return db.get(User, user_id)
    return db.query(User).filter(User.username == settings.admin_username).first()


def find(db: Session, user_id: str, title: str) -> Story | None:
    """This account's copy of a sample, under its new title or its old one."""
    return (
        db.query(Story)
        .filter(Story.user_id == user_id, Story.title.in_([title, OLD.get(title, title)]))
        .order_by(Story.created_at)
        .first()
    )
