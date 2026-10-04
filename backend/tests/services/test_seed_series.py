"""The Lighthouse Years demo shows what a series does, and seeds once."""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.series import Series
from app.models.story import Story
from app.models.structure import StructureNode
from app.services import seed, seed_series
from app.services.findings import collect
from app.services.proposals import gather
from app.services.proposals.sources import scene_titles
from app.services.series import service


def _seed(db_session: Session, monkeypatch) -> tuple[Story, Story]:
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    monkeypatch.setattr(seed_series, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    seed_series.seed_lighthouse_sequel()
    seed_series.seed_lighthouse_sequel()
    one = db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()
    two = db_session.query(Story).filter(Story.title == seed_series.SEQUEL).one()
    return one, two


def test_the_sequel_is_book_two_and_carries_eleanor_on(db_session: Session, monkeypatch):
    one, two = _seed(db_session, monkeypatch)
    [series] = db_session.query(Series).all()
    assert series.name == "The Lighthouse Years"
    assert service.positions(series) == {one.id: 0, two.id: 1}
    assert two.structure_template_id == one.structure_template_id and two.genre == one.genre
    words = sum(n.word_count or 0 for n in db_session.query(StructureNode).filter(StructureNode.story_id == two.id))
    assert words > 50, "its scenes are counted, so the dashboard does not call it not started"

    names = {c.name for c in db_session.query(Character).filter(Character.story_id == two.id)}
    assert names == {"Eleanor Vance", "Thomas Vance"}
    hers = db_session.query(Character).filter(Character.story_id == two.id, Character.name == "Eleanor Vance").one()
    assert (
        hers.personality
        != db_session.query(Character)
        .filter(Character.story_id == one.id, Character.name == "Eleanor Vance")
        .one()
        .personality
    )


def test_it_shows_a_disagreement_and_a_proposal(db_session: Session, monkeypatch):
    one, two = _seed(db_session, monkeypatch)
    for story in (one, two):
        canon = [f for f in collect(story, db_session).findings if f.check == "series-canon"]
        assert [f.fix.field for f in canon if f.fix] == ["background"], story.title

    proposals = [p for p in gather(two.id, db_session) if p.id.startswith("series-")]
    assert [p.subject for p in proposals] == ["Margaret Holt"]
    assert proposals[0].where in scene_titles(two.id, db_session).values()
