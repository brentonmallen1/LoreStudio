"""Kept Assistant answers (A6): written on success, replaced by asking again, cleared, and
gone with their story or their subject."""

from app.models.assistant_result import AssistantResult
from app.services import assistant_results


def _story_and_place(client):
    sid = client.post("/api/stories", json={"title": "The Last Lighthouse"}).json()["id"]
    place = client.post(f"/api/stories/{sid}/locations", json={"name": "The lamp room"})
    assert place.status_code == 201, place.text
    return sid, place.json()["id"]


def _ask(client, sid, place_id):
    return client.post(f"/api/stories/{sid}/worldbuilding/what-exists", json={"location_id": place_id})


def _kept(client, sid, place_id):
    r = client.get(f"/api/stories/{sid}/assistant-results?subject_type=location&subject_id={place_id}")
    assert r.status_code == 200, r.text
    return r.json()


def test_a_good_answer_is_kept_and_asking_again_replaces_it(client, mock_ai_gateway):
    sid, place_id = _story_and_place(client)
    mock_ai_gateway(structured_data={"questions": ["Who trims the wick?"]})
    assert _ask(client, sid, place_id).status_code == 200
    [first] = _kept(client, sid, place_id)
    assert first["feature"] == "what-exists"
    assert first["data"] == {"questions": ["Who trims the wick?"]}
    assert first["heading"]

    mock_ai_gateway(structured_data={"questions": ["Who keeps the log?"]})
    assert _ask(client, sid, place_id).status_code == 200
    [again] = _kept(client, sid, place_id)
    assert again["id"] == first["id"]
    assert again["data"] == {"questions": ["Who keeps the log?"]}


def test_a_failed_answer_leaves_the_kept_one_alone(client, mock_ai_gateway):
    sid, place_id = _story_and_place(client)
    mock_ai_gateway(structured_data={"questions": ["Who trims the wick?"]})
    _ask(client, sid, place_id)
    mock_ai_gateway(should_fail=True)
    _ask(client, sid, place_id)
    [kept] = _kept(client, sid, place_id)
    assert kept["data"] == {"questions": ["Who trims the wick?"]}


def test_nothing_is_kept_when_the_first_answer_fails(client, mock_ai_gateway):
    sid, place_id = _story_and_place(client)
    mock_ai_gateway(should_fail=True)
    _ask(client, sid, place_id)
    assert _kept(client, sid, place_id) == []


def test_clear_deletes_one_answer(client, mock_ai_gateway):
    sid, place_id = _story_and_place(client)
    mock_ai_gateway(structured_data={"questions": []})
    _ask(client, sid, place_id)
    [kept] = _kept(client, sid, place_id)
    assert client.delete(f"/api/stories/{sid}/assistant-results/{kept['id']}").status_code == 204
    assert _kept(client, sid, place_id) == []
    assert client.delete(f"/api/stories/{sid}/assistant-results/{kept['id']}").status_code == 404


def test_an_unknown_subject_type_is_refused(client):
    sid, _ = _story_and_place(client)
    r = client.get(f"/api/stories/{sid}/assistant-results?subject_type=story&subject_id=x")
    assert r.status_code == 400


def test_deleting_the_place_or_the_story_takes_its_answers(client, db_session, mock_ai_gateway):
    sid, place_id = _story_and_place(client)
    mock_ai_gateway(structured_data={"questions": []})
    _ask(client, sid, place_id)
    assert client.delete(f"/api/locations/{place_id}").status_code in (200, 204)
    db_session.expire_all()
    assert db_session.query(AssistantResult).count() == 0

    sid, place_id = _story_and_place(client)
    _ask(client, sid, place_id)
    assert db_session.query(AssistantResult).count() == 1
    assert client.delete(f"/api/stories/{sid}").status_code == 204
    db_session.expire_all()
    assert db_session.query(AssistantResult).count() == 0


def test_save_upserts_one_row_per_subject_and_feature(db_session, test_user):
    from tests.fixtures.story_factory import build_full_story

    story = build_full_story(db_session, test_user)
    kw = {"story_id": story.id, "subject_type": "plot_thread", "subject_id": "t1"}
    assistant_results.save(db_session, feature="thread-analysis", data={"a": 1}, **kw)
    assistant_results.save(db_session, feature="thread-analysis", data={"a": 2}, **kw)
    assistant_results.save(db_session, feature="twist-impact", data={"b": 1}, **kw)
    rows = assistant_results.for_subject(db_session, story.id, "plot_thread", "t1")
    assert sorted(r.feature for r in rows) == ["thread-analysis", "twist-impact"]
    assert next(r for r in rows if r.feature == "thread-analysis").data == {"a": 2}
    assert next(r for r in rows if r.feature == "thread-analysis").heading == "Thread Analysis"


def test_the_lighthouse_keeps_one_answer_on_a_place(db_session, monkeypatch):
    from app.models.activity_log import ActivityLog
    from app.models.location import Location
    from app.models.story import Story
    from app.services import sample_titles, seed

    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()

    story = db_session.query(Story).filter(Story.title == sample_titles.NOVEL).one()
    [answer] = db_session.query(AssistantResult).filter_by(story_id=story.id).all()
    place = db_session.get(Location, answer.subject_id)
    assert (answer.subject_type, answer.feature, place.name) == ("location", "what-exists", "The Lighthouse")
    assert answer.data["questions"]
    assert db_session.get(ActivityLog, answer.ai_call_log_id).metadata_["feature"] == "what-exists"
