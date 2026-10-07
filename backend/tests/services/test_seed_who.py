"""Who are they in the demos (doc 20 R8): the sheet shows how the fields are meant to be used."""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.compendium import CompendiumEntry
from app.models.story import Story
from app.services import seed
from app.services.findings.view import load_view
from app.services.talk import talk


def _seed(db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    seed.seed_short_story_demo()


def _person(db: Session, name: str) -> Character:
    return db.query(Character).filter(Character.name == name).one()


def test_elenas_parkinsons_is_one_entry_with_who_knows_and_its_research(db_session: Session, monkeypatch):
    _seed(db_session, monkeypatch)
    elena = _person(db_session, "Elena Sorokina")
    (entry,) = elena.facets
    research = db_session.query(CompendiumEntry).filter(CompendiumEntry.id.in_(entry["research"])).one()
    assert entry["name"] == "Parkinson's" and entry["known"] == "some" and entry["revealed_in"]
    assert research.title == "Parkinson's and the Professional Musician"
    assert "Parkinson" not in elena.background, "the sentence left the background for the entry"


def test_the_lighthouse_shows_a_wound_a_body_and_women_talking(db_session: Session, monkeypatch):
    _seed(db_session, monkeypatch)
    calder = _person(db_session, "The Visitor (Calder)")
    margaret = _person(db_session, "Margaret Holt")
    assert calder.formative[0]["wound"] and calder.formative[0]["notes"] == ["grief", "drowning"]
    assert margaret.facets[0]["name"] == "arthritis" and margaret.facets[0]["known"] == "everyone"
    story = db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()
    found = talk(load_view(story, db_session), db_session, None)
    assert found["group"] == ["woman"] and found["scenes"], "the demo's own dialogue has women talking"
