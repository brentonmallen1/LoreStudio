"""The samples (doc 26, P7), loaded on request: into the account that asks, only what it is missing."""

import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.models.story import Story
from app.models.user import User
from app.services import examples, sample_titles, seed, seed_screenplay, seed_series, seed_stage_play

ALL = [title for title, _ in examples.DEMO + examples.EXTRA]


@pytest.fixture
def seeds(db_session: Session, monkeypatch):
    """The seeders write through the test database."""
    for module in (seed, seed_screenplay, seed_series, seed_stage_play):
        monkeypatch.setattr(module, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()


def test_an_account_loads_every_missing_sample_once(client, db_session, test_user, seeds):
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
    gone = db_session.query(Story).filter(Story.title == sample_titles.SHORT).one()
    db_session.delete(gone)
    db_session.commit()

    assert client.get("/api/system/examples").json()["missing"] == [sample_titles.SHORT]
    assert client.post("/api/system/examples").json() == {"added": [sample_titles.SHORT], "missing": []}


def test_a_sample_under_its_old_title_is_not_loaded_again(client, db_session, test_user, seeds):
    """An install seeded before the samples were named holds "The Audition"."""
    db_session.add(Story(user_id=test_user.id, title="The Audition", story_format="prose"))
    db_session.commit()
    assert sample_titles.SHORT not in client.get("/api/system/examples").json()["missing"]


def test_every_account_loads_its_own_copy(client, db_session, test_user, seeds, monkeypatch):
    """Not only the admin account (it was, before the samples)."""
    monkeypatch.setattr(settings, "admin_username", "admin")
    other = User(username="someone", display_name="Someone", password_hash="x")
    db_session.add(other)
    db_session.commit()
    seed_stage_play.seed_stage_play_demo(other.id)
    assert client.get("/api/system/examples").json()["missing"] == ALL
    client.post("/api/system/examples")
    owners = {u for (u,) in db_session.query(Story.user_id).filter(Story.title == sample_titles.STAGE_PLAY)}
    assert owners == {test_user.id, other.id}


def test_two_accounts_can_both_load_every_sample(client, db_session, test_user, seeds):
    """Nothing in a sample has a fixed id: a second copy does not collide with the first."""
    other = User(username="someone", display_name="Someone", password_hash="x")
    db_session.add(other)
    db_session.commit()
    for _, seeder in examples.DEMO + examples.EXTRA:
        seeder(other.id)
    assert client.post("/api/system/examples").json() == {"added": ALL, "missing": []}
