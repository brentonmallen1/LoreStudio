"""A reading measures what the Numbers page shows, now or from a snapshot (doc 19, R0)."""

from collections import Counter

import pytest
from sqlalchemy.orm import Session

from app.models.story import Story
from app.models.structure import StructureNode
from app.services import seed
from app.services.findings.view import load_view
from app.services.nlp_runs import run_prose_analysis
from app.services.numbers import dialogue, summaries, words
from app.services.numbers_reading import measure, measure_now, measure_snapshot
from app.services.snapshot_service import create_snapshot, resolve_snapshot_data


@pytest.fixture
def demo(db_session: Session, monkeypatch) -> Story:
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    return db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()


def test_a_reading_matches_the_page(demo: Story, db_session: Session, client, test_user):
    demo.user_id = test_user.id  # the client reads as the test user
    db_session.commit()
    reading = measure_now(demo, db_session)
    view = load_view(demo, db_session)

    assert reading["words"] == words(view).model_dump(mode="json")
    assert reading["summaries"] == summaries(view).model_dump()
    live = dialogue(view, db_session)
    assert reading["dialogue"]["total_lines"] == live.total_lines
    assert reading["dialogue"]["balance"] == live.balance
    assert reading["dialogue"]["speakers"] == [s.model_dump() for s in live.speakers]

    # Who is on each page and what it carries, as /scene-cast says.
    cast = {e["node_id"]: e for e in client.get(f"/api/stories/{demo.id}/scene-cast").json()["scenes"]}
    for scene in reading["scenes"]:
        assert scene["characters"] == cast[scene["id"]]["character_ids"], scene["title"]
        assert Counter(t["id"] for t in scene["threads"]) == Counter(cast[scene["id"]]["thread_ids"])
    assert reading["findings"] and sum(reading["findings"].values()) > 0


def test_the_scenes_are_the_charts_scenes(demo: Story, db_session: Session):
    reading = measure_now(demo, db_session)
    titles = [s["title"] for s in reading["scenes"]]

    assert titles[0] == "The Light"
    assert len(titles) == len(set(s["id"] for s in reading["scenes"]))
    assert all(s["parent_id"] in {c["id"] for c in reading["chapters"]} for s in reading["scenes"])
    # The beat sheet's beats come with the reading, where the sheet places them.
    assert reading["beats"] and all(0 <= b["at"] <= 1 for b in reading["beats"])


def test_a_snapshot_reads_as_the_story_did(demo: Story, db_session: Session):
    run_prose_analysis(demo.id, demo.user_id, db_session)
    db_session.commit()
    now = measure_now(demo, db_session)
    snap = create_snapshot(demo.id, db_session, trigger="manual", name="Before")
    assert snap is not None

    # The story moves on; the snapshot still reads as it was.
    first = db_session.get(StructureNode, now["scenes"][0]["id"])
    first.word_count = (first.word_count or 0) + 500
    db_session.commit()

    then = measure_snapshot(demo, resolve_snapshot_data(snap, db_session), snap.created_at, db_session)
    assert then["findings"] is None
    for key in ("words", "scenes", "chapters", "characters", "threads", "beats", "dialogue", "summaries"):
        assert then[key] == now[key], key
    assert then["prose"]["run_id"] == now["prose"]["run_id"]
    assert measure_now(demo, db_session)["words"]["total"] == now["words"]["total"] + 500


def test_an_old_snapshot_without_newer_fields_is_still_measured():
    state = {
        "story": {"id": "s", "intended_length": "novel"},
        "structure_nodes": [
            {"id": "c1", "parent_id": None, "position": 0, "level": 0, "title": "One"},
            {"id": "a", "parent_id": "c1", "position": 0, "level": 1, "title": "A", "word_count": 120},
        ],
        "characters": [{"id": "el", "name": "Eleanor"}],
    }

    reading = measure(state, deepest=1, beats=[])

    assert reading["words"]["total"] == 120
    assert reading["scenes"][0]["status"] == "draft"
    assert reading["characters"][0]["arc"] == {"done": 0, "total": 0}
    assert reading["dialogue"]["total_lines"] == 0
