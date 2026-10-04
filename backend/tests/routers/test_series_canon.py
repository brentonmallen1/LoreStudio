"""Keeping canon straight: one finding per disagreement, the same in every book, one word for all."""

from app.models import Character
from app.schemas.findings import FindingAnchor
from app.services.findings.fingerprint import anchor_key
from tests.fixtures.series_factory import empty_book, make_book


def _two_books(client, db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.story.id, two.id]}).json()["id"]
    el = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}
    ).json()["elements"][0]
    series = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id}).json()
    hers = db_session.get(Character, series["elements"][0]["members"][1]["ref_id"])
    return sid, el["id"], one, two, hers


def _canon(client, story_id):
    return [
        f for f in client.get(f"/api/stories/{story_id}/findings").json()["findings"] if f["check"] == "series-canon"
    ]


def test_old_findings_keep_their_ids():
    anchor = FindingAnchor(node_id="n", character_id="c")
    assert anchor_key(anchor) == "n|c|||"
    assert anchor_key(FindingAnchor(series_element_id="e")) == "||||" + "|series:e"


def test_change_is_the_point_and_disagreement_is_a_question(client, db_session, test_user):
    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    hers.personality = "Opening up."
    db_session.commit()
    assert _canon(client, one.story.id) == [] and _canon(client, two.id) == []

    hers.background = "Born inland, in the town."
    db_session.commit()
    [in_two] = _canon(client, two.id)
    [in_one] = _canon(client, one.story.id)
    assert in_one["id"] == in_two["id"], "the same finding in every book"
    assert in_two["text"] == "Eleanor's background here differs from Book 1"
    assert "Book 1: “Born in the keeper's cottage.”" in in_two["evidence"]
    assert in_two["anchor"]["character_id"] == hers.id and in_one["anchor"]["character_id"] == one.eleanor.id
    assert in_two["fix"]["kind"] == "series" and in_two["fix"]["field"] == "background"

    gathered = client.get(f"/api/series/{sid}/findings").json()
    assert len(gathered) == 1 and set(gathered[0]["story_ids"]) == {one.story.id, two.id}
    assert gathered[0]["text"] == "Eleanor's background: the books disagree"


def test_a_book_that_says_nothing_has_nothing_to_dismiss(client, db_session, test_user):
    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    hers.appearance = ""
    db_session.commit()
    assert _canon(client, two.id) == [] and _canon(client, one.story.id) == []


def test_dismissed_once_dismissed_everywhere_and_back_together(client, db_session, test_user):
    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    hers.background = "Born inland."
    db_session.commit()
    [f] = _canon(client, two.id)

    assert client.post(f"/api/stories/{two.id}/findings/{f['id']}/dismiss").status_code == 204
    assert _canon(client, one.story.id) == [] and _canon(client, two.id) == []
    assert client.get(f"/api/series/{sid}/findings").json() == []

    assert client.delete(f"/api/stories/{one.story.id}/findings/{f['id']}/dismiss").status_code == 204
    assert len(_canon(client, one.story.id)) == 1 and len(_canon(client, two.id)) == 1

    # A new disagreement is a new question, past any dismissal of the old one.
    client.post(f"/api/stories/{two.id}/findings/{f['id']}/dismiss")
    hers.background = "Born at sea, in a storm."
    db_session.commit()
    [again] = _canon(client, two.id)
    assert again["id"] != f["id"]


def test_use_this_in_every_book(client, db_session, test_user):
    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    hers.background = "Born inland."
    db_session.commit()
    [f] = _canon(client, two.id)

    r = client.post(f"/api/stories/{two.id}/findings/{f['id']}/fix")
    assert r.status_code == 200 and r.json() == {"node_id": None, "replaced": 1}
    db_session.expire_all()
    assert db_session.get(Character, one.eleanor.id).background == "Born inland."
    assert _canon(client, one.story.id) == [] and _canon(client, two.id) == []
    # Book one logged its own edit, so its undo takes it back.
    client.post(f"/api/stories/{one.story.id}/undo")
    db_session.expire_all()
    assert db_session.get(Character, one.eleanor.id).background == "Born in the keeper's cottage."


def test_a_series_decides_what_stays_true(client, db_session, test_user):
    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    hers.background = "Born inland."
    hers.personality = "Opening up."
    db_session.commit()

    out = client.patch(
        f"/api/series/{sid}/field-classes", json={"kind": "character", "field": "background", "field_class": "evolving"}
    ).json()
    assert out["field_classes"] == {"character": {"background": "evolving"}}
    assert _canon(client, two.id) == []
    r = client.post(
        f"/api/series/{sid}/elements/{eid}/propagate", json={"field": "background", "source_story_id": two.id}
    )
    assert r.status_code == 400

    client.patch(
        f"/api/series/{sid}/field-classes",
        json={"kind": "character", "field": "personality", "field_class": "enduring"},
    )
    assert [f["fix"]["field"] for f in _canon(client, two.id)] == ["personality"]
    r = client.patch(
        f"/api/series/{sid}/field-classes", json={"kind": "character", "field": "background", "field_class": None}
    )
    assert r.json()["field_classes"] == {"character": {"personality": "enduring"}}

    r = client.post(
        f"/api/series/{sid}/elements/{eid}/propagate", json={"field": "personality", "source_story_id": one.story.id}
    )
    assert r.status_code == 200
    db_session.expire_all()
    assert db_session.get(Character, hers.id).personality == "Guarded."


def test_a_finding_about_one_book_only_is_dismissed_in_that_book_only(client, db_session, test_user):
    """Fan-out follows the series element, not the check: a book's own finding stays its own."""
    from app.models import FindingDismissal
    from tests.fixtures.series_factory import scenes, twist

    sid, eid, one, two, hers = _two_books(client, db_session, test_user)
    [s1] = scenes(db_session, two, "Arrival")
    twist(db_session, two, "The Letter", (s1, "misdirection", "It is from the ministry."))
    db_session.commit()
    [f] = [
        f
        for f in client.get(f"/api/stories/{two.id}/findings").json()["findings"]
        if f["check"] == "misdirection_unanswered"
    ]
    assert client.post(f"/api/stories/{two.id}/findings/{f['id']}/dismiss").status_code == 204
    held = {d.story_id for d in db_session.query(FindingDismissal).filter(FindingDismissal.fingerprint == f["id"])}
    assert held == {two.id}
