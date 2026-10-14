"""Tropes in the Lighthouse (doc 27): the sample shows a stance, a why and where each plays."""

from sqlalchemy.orm import Session

from app.models.compendium import CompendiumEntry
from app.models.story import Story
from app.models.trope import Trope
from app.services import sample_titles, seed
from app.services.findings.data import trope_checks
from app.services.findings.view import load_view


def test_the_lighthouse_plays_three_tropes_and_none_raises_a_finding(db_session: Session, monkeypatch):
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    story = db_session.query(Story).filter(Story.title == sample_titles.NOVEL).one()
    tropes = db_session.query(Trope).filter_by(story_id=story.id).order_by(Trope.position).all()
    assert [(t.name, t.stance) for t in tropes] == [
        ("Mysterious Stranger", "subverted"),
        ("Dark Secret", "subverted"),
        ("The Hermit", "deconstructed"),
    ]
    stranger, secret, hermit = tropes
    assert stranger.thread_id and secret.thread_id and hermit.thread_id is None
    assert {bool(lk.node_id) for lk in secret.links} == {True, False}  # Thomas, and the logbook scene
    assert all(db_session.get(CompendiumEntry, t.definition_id).tags == ["Trope"] for t in tropes)
    # Both threads turn, so the sample shows tropes without a finding about them.
    assert trope_checks(load_view(story, db_session)) == []
