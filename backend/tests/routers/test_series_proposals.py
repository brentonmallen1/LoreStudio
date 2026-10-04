"""Proposals from the series: someone named here who is not in this book yet, and a row of
this book's own that is the series' one."""

import uuid

from app.models import Character, StructureNode
from app.services.series import service
from tests.fixtures.series_factory import empty_book, make_book


def _series(client, db_session, test_user, two):
    one = make_book(db_session, test_user)
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.story.id, two.id]}).json()["id"]
    for ref in (one.eleanor.id, one.visitor.id):
        client.post(f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": ref})
    return sid, one


def _proposals(client, story_id):
    return [
        p for p in client.get(f"/api/stories/{story_id}/proposals").json()["proposals"] if p["id"].startswith("series-")
    ]


def test_named_in_this_book_but_not_in_it(client, db_session, test_user):
    two = empty_book(db_session, test_user, "Book Two")
    db_session.add(
        StructureNode(
            id=str(uuid.uuid4()),
            story_id=two.id,
            title="Return",
            level=0,
            level_type="scene",
            position=0,
            content="<p>Nell came back to the island in March. Annual storms, the same as ever.</p>",
        )
    )
    db_session.commit()
    sid, one = _series(client, db_session, test_user, two)

    [p] = _proposals(client, two.id)
    assert p["text"] == "Eleanor, from Keepers, is named here but is not in this book yet"
    assert "Nell came back" in p["evidence"] and p["where"] == "Return" and p["kind"] == "person"

    r = client.post(f"/api/stories/{two.id}/proposals/{p['id']}/act", json={"action": "add"})
    assert r.status_code == 200 and r.json()["entity_type"] == "character"
    assert db_session.get(Character, r.json()["entity_id"]).background == one.eleanor.background
    assert _proposals(client, two.id) == []


def test_a_name_inside_another_word_is_not_a_mention(client, db_session, test_user):
    two = empty_book(db_session, test_user, "Book Two")
    db_session.add(
        StructureNode(
            id=str(uuid.uuid4()),
            story_id=two.id,
            title="Words",
            level=0,
            level_type="scene",
            position=0,
            content="<p>Eleanorian architecture. The Visitors' Centre.</p>",
        )
    )
    db_session.commit()
    _series(client, db_session, test_user, two)
    assert _proposals(client, two.id) == []


def test_this_books_own_eleanor_is_the_series_one(client, db_session, test_user):
    two = empty_book(db_session, test_user, "Book Two")
    hers = Character(id=str(uuid.uuid4()), story_id=two.id, name="eleanor")
    db_session.add(hers)
    db_session.commit()
    sid, one = _series(client, db_session, test_user, two)

    [p] = _proposals(client, two.id)
    assert p["id"] == f"series-same:{service.element_for_row(db_session, 'characters', one.eleanor.id).id}:{hers.id}"
    assert p["actions"][0]["label"] == "The same one"

    r = client.post(f"/api/stories/{two.id}/proposals/{p['id']}/act", json={"action": "link"})
    assert r.json()["entity_id"] == hers.id
    assert service.element_for_row(db_session, "characters", hers.id) is not None
    assert _proposals(client, two.id) == []


def test_someone_else_stays_declined(client, db_session, test_user):
    two = empty_book(db_session, test_user, "Book Two")
    db_session.add(Character(id=str(uuid.uuid4()), story_id=two.id, name="Eleanor"))
    db_session.commit()
    _series(client, db_session, test_user, two)
    [p] = _proposals(client, two.id)
    assert client.post(f"/api/stories/{two.id}/proposals/{p['id']}/decline").status_code == 204
    assert _proposals(client, two.id) == []


def test_a_standalone_book_gets_none(client, db_session, test_user):
    one = make_book(db_session, test_user)
    db_session.commit()
    assert _proposals(client, one.story.id) == []


def test_a_first_name_is_enough_unless_this_book_has_its_own(client, db_session, test_user):
    two = empty_book(db_session, test_user, "Book Two")
    db_session.add(
        StructureNode(
            id=str(uuid.uuid4()),
            story_id=two.id,
            title="Kitchen",
            level=0,
            level_type="scene",
            position=0,
            content="<p>Margaret put the kettle on.</p>",
        )
    )
    db_session.commit()
    sid, one = _series(client, db_session, test_user, two)
    margaret = Character(id=str(uuid.uuid4()), story_id=one.story.id, name="Margaret Holt")
    db_session.add(margaret)
    db_session.commit()
    client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": margaret.id}
    )
    assert [p["subject"] for p in _proposals(client, two.id)] == ["Margaret Holt"]

    db_session.add(Character(id=str(uuid.uuid4()), story_id=two.id, name="Margaret Brook"))
    db_session.commit()
    assert _proposals(client, two.id) == []
