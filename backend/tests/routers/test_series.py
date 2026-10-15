"""The series endpoints: books in order, elements shared, copied, linked and let go."""

import uuid

from app.models import Character, Series, Story, User
from tests.fixtures.series_factory import empty_book, make_book


def _make(client, db_session, test_user):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "The Keeper's Daughter")
    db_session.commit()
    r = client.post(
        "/api/series",
        json={"name": "The Lighthouse Years", "premise": "A light, a family", "story_ids": [one.story.id, two.id]},
    )
    assert r.status_code == 201, r.text
    return r.json(), one, two


def test_create_list_get_and_rename(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    assert [b["title"] for b in series["books"]] == ["The Last Lighthouse", "The Keeper's Daughter"]
    assert [b["position"] for b in series["books"]] == [0, 1]

    listed = client.get("/api/series").json()
    assert [s["name"] for s in listed] == ["The Lighthouse Years"]
    assert len(listed[0]["books"]) == 2

    r = client.patch(f"/api/series/{series['id']}", json={"name": "  Keepers  ", "intent": "Inheritance"})
    assert r.json()["name"] == "Keepers" and r.json()["intent"] == "Inheritance"
    assert client.patch(f"/api/series/{series['id']}", json={"name": " "}).status_code == 400


def test_a_book_knows_its_series(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    r = client.get(f"/api/stories/{two.id}/series").json()
    assert r["series"]["id"] == series["id"] and r["position"] == 1

    alone = empty_book(db_session, test_user, "Standalone")
    db_session.commit()
    assert client.get(f"/api/stories/{alone.id}/series").json() == {"series": None, "position": None}


def test_join_reorder_and_leave(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    sid = series["id"]
    prequel = empty_book(db_session, test_user, "Before the Light")
    db_session.commit()

    r = client.post(f"/api/series/{sid}/stories", json={"story_id": prequel.id, "position": 0})
    assert [b["title"] for b in r.json()["books"]][0] == "Before the Light"

    r = client.put(f"/api/series/{sid}/stories", json={"story_ids": [one.story.id, prequel.id, two.id]})
    assert [b["story_id"] for b in r.json()["books"]] == [one.story.id, prequel.id, two.id]
    assert client.put(f"/api/series/{sid}/stories", json={"story_ids": [one.story.id]}).status_code == 400

    other = client.post("/api/series", json={"name": "Other"}).json()
    r = client.post(f"/api/series/{other['id']}/stories", json={"story_id": two.id})
    assert r.status_code == 409 and "The Lighthouse Years" in r.json()["detail"]

    assert client.delete(f"/api/series/{sid}/stories/{prequel.id}").status_code == 204
    assert len(client.get(f"/api/series/{sid}").json()["books"]) == 2
    assert client.delete(f"/api/series/{sid}/stories/{prequel.id}").status_code == 404


def test_share_bring_in_link_and_let_go(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    sid = series["id"]

    r = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}
    )
    [el] = r.json()["elements"]
    assert el["name"] == "Eleanor" and el["lore_kind"] == "character"
    assert [m["story_id"] for m in el["members"]] == [one.story.id]

    r = client.post(
        f"/api/series/{sid}/elements",
        json={"kind": "historical_event", "story_id": one.story.id, "ref_id": one.storm.id},
    )
    event = next(e for e in r.json()["elements"] if e["kind"] == "historical_event")
    assert event["lore_kind"] == "event"

    r = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id})
    assert r.status_code == 200, r.text
    members = next(e for e in r.json()["elements"] if e["id"] == el["id"])["members"]
    assert [m["position"] for m in members] == [0, 1]
    copy = db_session.get(Character, members[1]["ref_id"])
    assert copy.story_id == two.id and copy.background == one.eleanor.background
    assert client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id}).status_code == 409

    # Undo in book two takes her back out of it.
    assert client.post(f"/api/stories/{two.id}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.get(Character, copy.id) is None
    el_now = next(e for e in client.get(f"/api/series/{sid}").json()["elements"] if e["id"] == el["id"])
    assert [m["story_id"] for m in el_now["members"]] == [one.story.id]

    # Let go in book one: the element is in no book, so it goes; the character stays.
    r = client.delete(f"/api/series/{sid}/elements/{el['id']}/members/{one.story.id}")
    assert [e["id"] for e in r.json()["elements"]] == [event["id"]]
    assert db_session.get(Character, one.eleanor.id) is not None

    r = client.delete(f"/api/series/{sid}/elements/{event['id']}")
    assert r.json()["elements"] == []


def test_link_a_row_the_book_already_has(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    sid = series["id"]
    hers = Character(id=str(uuid.uuid4()), story_id=two.id, name="Eleanor")
    db_session.add(hers)
    db_session.commit()
    el = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}
    ).json()["elements"][0]

    r = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id, "ref_id": hers.id})
    members = r.json()["elements"][0]["members"]
    assert members[1]["ref_id"] == hers.id


def test_unknown_kinds_and_rows_are_refused(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    sid = series["id"]
    assert (
        client.post(
            f"/api/series/{sid}/elements", json={"kind": "scene_link", "story_id": one.story.id, "ref_id": "x"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": "nope"}
        ).status_code
        == 404
    )
    outside = empty_book(db_session, test_user, "Not in it")
    db_session.commit()
    r = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": outside.id, "ref_id": one.eleanor.id}
    )
    assert r.status_code == 404


def test_deleting_the_series_keeps_every_book(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    client.post(
        f"/api/series/{series['id']}/elements",
        json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id},
    )
    assert client.delete(f"/api/series/{series['id']}").status_code == 204
    assert db_session.query(Series).count() == 0
    assert db_session.query(Story).count() == 2
    assert db_session.get(Character, one.eleanor.id) is not None


def test_another_users_series_is_not_found(client, db_session, test_user):
    stranger = User(
        id=str(uuid.uuid4()), username="other", password_hash="x", display_name="O", is_admin=False, settings={}
    )
    db_session.add(stranger)
    db_session.flush()
    theirs = Series(user_id=stranger.id, name="Theirs", field_classes={})
    their_book = empty_book(db_session, stranger, "Their book")
    db_session.add(theirs)
    db_session.commit()

    assert client.get(f"/api/series/{theirs.id}").status_code == 404
    assert client.get("/api/series").json() == []
    assert client.post("/api/series", json={"name": "Mine", "story_ids": [their_book.id]}).status_code == 404


def test_an_element_book_by_book(client, db_session, test_user):
    series, one, two = _make(client, db_session, test_user)
    sid = series["id"]
    el = client.post(
        f"/api/series/{sid}/elements",
        json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id},
    ).json()["elements"][0]
    members = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id}).json()[
        "elements"
    ][0]["members"]
    hers = db_session.get(Character, members[1]["ref_id"])
    hers.personality = "Opening up."
    hers.background = "Born inland."
    db_session.commit()

    detail = client.get(f"/api/series/{sid}/elements/{el['id']}").json()
    fields = {f["key"]: f for f in detail["fields"]}
    assert fields["personality"]["field_class"] == "evolving" and fields["personality"]["differs"] is False
    assert [v["value"] for v in fields["personality"]["values"]] == ["Guarded.", "Opening up."]
    assert fields["background"]["field_class"] == "enduring" and fields["background"]["differs"] is True
    assert fields["appearance"]["differs"] is False


def _share_eleanor(client, sid, one, two):
    """Eleanor in both books: a shared element with a member in each."""
    r = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}
    )
    assert r.status_code in (200, 201), r.text
    [el] = r.json()["elements"]
    r = client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id})
    assert r.status_code in (200, 201), r.text


def test_deleting_a_series_keeps_its_books_by_default(client, db_session, test_user):
    from app.models import SeriesElement, SeriesStory

    series, one, two = _make(client, db_session, test_user)
    _share_eleanor(client, series["id"], one, two)
    assert client.delete(f"/api/series/{series['id']}").status_code == 204
    db_session.expire_all()
    assert db_session.get(Series, series["id"]) is None
    for story_id in (one.story.id, two.id):
        assert db_session.get(Story, story_id) is not None
        assert client.get(f"/api/stories/{story_id}/series").json() == {"series": None, "position": None}
    assert db_session.query(SeriesStory).count() == 0
    assert db_session.query(SeriesElement).count() == 0
    # Each book keeps its own rows: Eleanor in both.
    assert db_session.query(Character).filter_by(name="Eleanor").count() == 2


def test_deleting_a_series_with_its_books_deletes_the_stories(client, db_session, test_user):
    from app.models import SeriesElement, SeriesElementMember, SeriesStory

    series, one, two = _make(client, db_session, test_user)
    _share_eleanor(client, series["id"], one, two)
    other = empty_book(db_session, test_user, "Not in the series")
    db_session.commit()

    assert client.delete(f"/api/series/{series['id']}?books=delete").status_code == 204
    db_session.expire_all()
    assert db_session.get(Series, series["id"]) is None
    assert db_session.get(Story, one.story.id) is None and db_session.get(Story, two.id) is None
    assert db_session.query(Character).filter(Character.story_id.in_([one.story.id, two.id])).count() == 0
    assert db_session.query(SeriesStory).count() == 0
    assert db_session.query(SeriesElement).count() == 0
    assert db_session.query(SeriesElementMember).count() == 0
    assert db_session.get(Story, other.id) is not None


def test_a_plain_series_deleted_with_its_books_goes_once(client, db_session, test_user):
    """With no plan of its own, the series goes with its last book: deleting it again must not fail."""
    one = empty_book(db_session, test_user, "Alone")
    db_session.commit()
    plain = client.post("/api/series", json={"name": "Just a group", "story_ids": [one.id]}).json()
    assert client.delete(f"/api/series/{plain['id']}?books=delete").status_code == 204
    db_session.expire_all()
    assert db_session.get(Series, plain["id"]) is None and db_session.get(Story, one.id) is None


def test_deleting_a_series_takes_keep_or_delete_only(client, db_session, test_user):
    series, _, _ = _make(client, db_session, test_user)
    assert client.delete(f"/api/series/{series['id']}?books=some").status_code == 422
    assert client.get(f"/api/series/{series['id']}").status_code == 200
