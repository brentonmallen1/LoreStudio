"""Small books for the series tests: a lighthouse keeper, the stranger she knows, a coast."""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Character, CharacterRelationship, Era, HistoricalEvent, Location, Story
from app.models.user import User


def _uid() -> str:
    return str(uuid.uuid4())


@dataclass
class Book:
    story: Story
    eleanor: Character
    visitor: Character
    coast: Location
    lighthouse: Location
    era: Era
    storm: HistoricalEvent


def make_book(db: Session, user: User, title: str = "The Last Lighthouse") -> Book:
    """One book with two characters who know each other, a place inside a place, an era and its event."""
    story = Story(id=_uid(), user_id=user.id, title=title)
    db.add(story)
    db.flush()
    eleanor = Character(
        id=_uid(),
        story_id=story.id,
        name="Eleanor",
        background="Born in the keeper's cottage.",
        appearance="Grey eyes, salt in her hair.",
        personality="Guarded.",
        mission_statement="Keep the light burning.",
        aliases=["Nell"],
        arc_milestones=[{"id": "m1", "text": "Lets the visitor in", "completed": True, "scene_id": "x"}],
    )
    visitor = Character(id=_uid(), story_id=story.id, name="The Visitor", personality="Watchful.")
    coast = Location(id=_uid(), story_id=story.id, name="The Coast", history="Wrecks since 1700.")
    db.add_all([eleanor, visitor, coast])
    db.flush()
    lighthouse = Location(
        id=_uid(),
        story_id=story.id,
        parent_id=coast.id,
        name="The Lighthouse",
        history="Built 1894.",
        atmosphere="Cold and loud.",
    )
    era = Era(id=_uid(), story_id=story.id, name="The Lamp Years", start_date="1894")
    db.add_all([lighthouse, era])
    db.flush()
    storm = HistoricalEvent(id=_uid(), story_id=story.id, era_id=era.id, name="The Great Storm", in_world_date="1962")
    db.add(storm)
    db.add(
        CharacterRelationship(
            id=_uid(),
            character_id=eleanor.id,
            related_character_id=visitor.id,
            relationship_type="stranger",
            description="She does not trust him yet.",
        )
    )
    db.flush()
    return Book(story, eleanor, visitor, coast, lighthouse, era, storm)


def empty_book(db: Session, user: User, title: str) -> Story:
    story = Story(id=_uid(), user_id=user.id, title=title)
    db.add(story)
    db.flush()
    return story
