"""The example stories, added on request: only to the admin account, only what is missing."""

import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.models.story import Story
from app.services import examples, seed, seed_screenplay, seed_series, seed_stage_play

ALL = [title for title, _ in examples.DEMO + examples.EXTRA]


@pytest.fixture
def seeds(db_session: Session, monkeypatch):
    """The seeders write through the test database, and the test user is the admin account."""
    for module in (seed, seed_screenplay, seed_series, seed_stage_play):
        monkeypatch.setattr(module, "engine", db_session.get_bind())
    monkeypatch.setattr(settings, "admin_username", "testuser")
    seed.seed_structure_templates()
    seed.seed_beat_sheets()


def test_the_admin_account_adds_every_missing_example_once(client, db_session, test_user, seeds):
    assert client.get("/api/system/examples").json() == {"available": True, "missing": ALL}

    first = client.post("/api/system/examples").json()
    assert first == {"added": ALL, "missing": []}
    titles = {t for (t,) in db_session.query(Story.title).filter(Story.user_id == test_user.id)}
    assert titles >= set(ALL), "the series also plans its third book"
    count = db_session.query(Story).count()

    assert client.post("/api/system/examples").json() == {"added": [], "missing": []}
    assert db_session.query(Story).count() == count


def test_only_what_was_deleted_comes_back(client, db_session, seeds):
    client.post("/api/system/examples")
    gone = db_session.query(Story).filter(Story.title == "The Audition").one()
    db_session.delete(gone)
    db_session.commit()

    assert client.get("/api/system/examples").json()["missing"] == ["The Audition"]
    assert client.post("/api/system/examples").json() == {"added": ["The Audition"], "missing": []}


def test_another_account_cannot_add_them(client, db_session, seeds, monkeypatch):
    monkeypatch.setattr(settings, "admin_username", "admin")
    assert client.get("/api/system/examples").json() == {"available": False, "missing": []}
    assert client.post("/api/system/examples").status_code == 403
    assert db_session.query(Story).count() == 0
