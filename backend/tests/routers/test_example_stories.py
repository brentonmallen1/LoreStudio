"""The samples (doc 26, P7), loaded on request: into the account that asks, only what it is missing."""

import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.models.character import Character
from app.models.series import Series
from app.models.story import Story
from app.models.structure import StructureNode
from app.models.user import User
from app.services import examples, sample_titles, seed, seed_screenplay, seed_series, seed_stage_play
from app.services.series import service as series_service

ALL = [title for title, _ in examples.DEMO + examples.EXTRA]


def _load(client, *titles):
    """POST /system/examples (every missing sample, or the ones named): what was added and
    what is still missing."""
    body = {"titles": list(titles)} if titles else None
    out = client.post("/api/system/examples", json=body).json()
    return {"added": out["added"], "missing": out["missing"]}


@pytest.fixture
def seeds(db_session: Session, monkeypatch):
    """The seeders write through the test database."""
    for module in (seed, seed_screenplay, seed_series, seed_stage_play):
        monkeypatch.setattr(module, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()


def test_an_account_loads_every_missing_sample_once(client, db_session, test_user, seeds):
    listed = client.get("/api/system/examples").json()
    assert listed["missing"] == ALL
    assert [(x["title"], x["loaded"]) for x in listed["samples"]] == [(t, False) for t in ALL]

    first = _load(client)
    assert first == {"added": ALL, "missing": []}
    titles = {t for (t,) in db_session.query(Story.title).filter(Story.user_id == test_user.id)}
    assert titles >= set(ALL), "the series also plans its third book"
    count = db_session.query(Story).count()

    assert _load(client) == {"added": [], "missing": []}
    assert db_session.query(Story).count() == count


def test_only_what_was_deleted_comes_back(client, db_session, seeds):
    client.post("/api/system/examples")
    gone = db_session.query(Story).filter(Story.title == sample_titles.SHORT).one()
    db_session.delete(gone)
    db_session.commit()

    assert client.get("/api/system/examples").json()["missing"] == [sample_titles.SHORT]
    assert _load(client) == {"added": [sample_titles.SHORT], "missing": []}


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
    assert _load(client) == {"added": ALL, "missing": []}


def _delete(client, db_session, *titles):
    """Through the route, as the dashboard deletes: out of the series first."""
    for title in titles:
        story = db_session.query(Story).filter(Story.title == title).one()
        assert client.delete(f"/api/stories/{story.id}").status_code == 204
    db_session.expire_all()


def _series_books(db_session) -> list[str]:
    (series,) = db_session.query(Series).all()
    return [b.story.title for b in sorted(series.books, key=lambda b: b.position)]


SERIES_BOOKS = [sample_titles.NOVEL, sample_titles.SERIES, sample_titles.SERIES_PLANNED]


@pytest.mark.parametrize(
    "gone", [[sample_titles.SERIES], [sample_titles.SERIES, sample_titles.SERIES_PLANNED]], ids=["sequel", "both"]
)
def test_the_series_comes_back_with_book_one_kept(client, db_session, seeds, gone):
    """Its first book still in what was left of the series, the sequel was listed as missing
    and Load did nothing."""
    client.post("/api/system/examples")
    _delete(client, db_session, *gone)

    assert _load(client) == {"added": [sample_titles.SERIES], "missing": []}
    assert _series_books(db_session) == SERIES_BOOKS


def test_a_planned_book_written_in_is_kept_out_of_the_series(client, db_session, seeds):
    client.post("/api/system/examples")
    third = db_session.query(Story).filter(Story.title == sample_titles.SERIES_PLANNED).one()
    db_session.add(StructureNode(story_id=third.id, level_type="scene", title="Mine", content="<p>Mine.</p>"))
    db_session.commit()
    _delete(client, db_session, sample_titles.SERIES)

    client.post("/api/system/examples")
    assert db_session.get(Story, third.id) is not None
    assert db_session.query(Story).filter(Story.title == sample_titles.SERIES_PLANNED).count() == 2


def test_a_series_with_the_writers_own_book_is_left_alone(client, db_session, test_user, seeds):
    client.post("/api/system/examples")
    _delete(client, db_session, sample_titles.SERIES)
    (series,) = db_session.query(Series).all()
    mine = Story(user_id=test_user.id, title="My book four", story_format="prose")
    db_session.add(mine)
    db_session.flush()
    series_service.attach_story(db_session, series, mine)
    db_session.commit()

    assert client.post("/api/system/examples").json()["added"] == []
    assert db_session.query(Series).count() == 1


def test_the_novel_loaded_again_is_book_one_of_the_series(client, db_session, seeds):
    client.post("/api/system/examples")
    _delete(client, db_session, sample_titles.NOVEL)

    assert _load(client) == {"added": [sample_titles.NOVEL], "missing": []}
    assert _series_books(db_session) == SERIES_BOOKS
    novel = db_session.query(Story).filter(Story.title == sample_titles.NOVEL).one()
    eleanor = (
        db_session.query(Character).filter(Character.story_id == novel.id, Character.name == "Eleanor Vance").one()
    )
    assert series_service.element_for_row(db_session, "characters", eleanor.id) is not None, (
        "carried on into the sequel"
    )


def test_one_sample_loads_on_its_own(client, db_session, seeds):
    assert _load(client, sample_titles.SHORT) == {
        "added": [sample_titles.SHORT],
        "missing": [t for t in ALL if t != sample_titles.SHORT],
    }
    listed = {x["title"]: x["loaded"] for x in client.get("/api/system/examples").json()["samples"]}
    assert listed[sample_titles.SHORT] and not listed[sample_titles.NOVEL], "every sample is still listed"
    assert _load(client, sample_titles.SHORT)["added"] == [], "one already loaded is not loaded again"


def test_the_series_loads_the_novel_it_is_built_on(client, db_session, seeds):
    series = next(x for x in client.get("/api/system/examples").json()["samples"] if x["title"] == sample_titles.SERIES)
    assert series["needs"] == [sample_titles.NOVEL]

    assert _load(client, sample_titles.SERIES)["added"] == [sample_titles.NOVEL, sample_titles.SERIES]
    assert _series_books(db_session) == SERIES_BOOKS


def test_a_sample_not_in_the_list_is_refused(client, seeds):
    assert client.post("/api/system/examples", json={"titles": ["Sample: Poem · Nothing"]}).status_code == 400
