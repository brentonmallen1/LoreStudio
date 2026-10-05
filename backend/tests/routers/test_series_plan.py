"""A series planned from the start (series v2): books before they are written, each book's
part, the arc across the books and what changes from book to book."""

from app.models import Story
from app.models.series import Series
from tests.fixtures.series_factory import empty_book


def _new_series(client, **extra):
    r = client.post("/api/series", json={"name": "The Lighthouse Years", "story_ids": [], **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_a_series_can_start_with_no_books(client):
    s = _new_series(client, premise="Three keepers, one light.")
    assert s["books"] == [] and s["arc"] == [] and s["axes"] == []
    [summary] = client.get("/api/series").json()
    assert summary["books"] == [] and summary["updated_at"]


def test_a_planned_book_is_an_unstarted_story_told_like_the_one_before(client, db_session, test_user):
    one = empty_book(db_session, test_user, "The Last Lighthouse")
    one.genre, one.tone, one.structure_template_id = "Literary", "Quiet", "three-act"
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Lighthouse Years", "story_ids": [one.id]}).json()["id"]

    r = client.post(f"/api/series/{sid}/books", json={"title": "  The Keeper's Daughter ", "role": "She stays."})
    assert r.status_code == 201, r.text
    out = r.json()
    two = db_session.get(Story, out["story_id"])
    assert two.title == "The Keeper's Daughter"
    assert (two.genre, two.tone, two.structure_template_id) == ("Literary", "Quiet", "three-act")
    assert two.structure_nodes == [], "not scaffolded: no empty chapters to raise findings"
    assert [(b["title"], b["role"]) for b in out["series"]["books"]] == [
        ("The Last Lighthouse", ""),
        ("The Keeper's Daughter", "She stays."),
    ]

    # One placed first, a prequel, is told like the first book.
    r = client.post(f"/api/series/{sid}/books", json={"title": "Before the Light", "position": 0})
    assert [b["title"] for b in r.json()["series"]["books"]][0] == "Before the Light"
    assert db_session.get(Story, r.json()["story_id"]).genre == "Literary"

    assert client.post(f"/api/series/{sid}/books", json={"title": "  "}).status_code == 400


def test_a_series_with_a_plan_waits_for_its_next_book(client, db_session, test_user):
    planned = _new_series(client, premise="Three keepers, one light.")
    book = client.post(f"/api/series/{planned['id']}/books", json={"title": "Book One"}).json()
    assert client.delete(f"/api/series/{planned['id']}/stories/{book['story_id']}").status_code in (200, 204)
    db_session.expire_all()
    assert db_session.get(Series, planned["id"]) is not None

    # One that only grouped books goes with its last book, as before.
    one = empty_book(db_session, test_user, "Alone")
    db_session.commit()
    plain = client.post("/api/series", json={"name": "Just a group", "story_ids": [one.id]}).json()
    client.delete(f"/api/series/{plain['id']}/stories/{one.id}")
    db_session.expire_all()
    assert db_session.get(Series, plain["id"]) is None


def test_the_arc_is_placed_on_books_and_a_beat_taken_out_leaves_them(client):
    s = _new_series(client)
    one = client.post(f"/api/series/{s['id']}/books", json={"title": "One"}).json()["story_id"]
    arc = client.put(
        f"/api/series/{s['id']}/arc",
        json={"arc": [{"name": "The light is lit"}, {"name": "The light goes out", "description": "Book 3"}]},
    ).json()["arc"]
    lit, out = arc[0]["id"], arc[1]["id"]
    assert [b["name"] for b in arc] == ["The light is lit", "The light goes out"]

    r = client.patch(f"/api/series/{s['id']}/books/{one}", json={"arc_beats": [lit, out, lit]})
    assert r.json()["books"][0]["arc_beats"] == [lit, out]
    assert client.patch(f"/api/series/{s['id']}/books/{one}", json={"arc_beats": ["nope"]}).status_code == 400

    r = client.put(f"/api/series/{s['id']}/arc", json={"arc": [arc[1]]})
    assert r.json()["books"][0]["arc_beats"] == [out]
    assert client.put(f"/api/series/{s['id']}/arc", json={"arc": [{"name": " "}]}).status_code == 400


def test_a_books_part_is_undone_in_that_book(client):
    s = _new_series(client)
    one = client.post(f"/api/series/{s['id']}/books", json={"title": "One"}).json()["story_id"]
    client.patch(f"/api/series/{s['id']}/books/{one}", json={"role": "She lights it."})
    r = client.patch(f"/api/series/{s['id']}/books/{one}", json={"role": "She lights it, and stays."})
    assert r.json()["books"][0]["role"] == "She lights it, and stays."
    changes = client.get(f"/api/stories/{one}/changes").json()
    assert any("Edit this book's part in “The Lighthouse Years”" in str(c) for c in changes)

    assert client.post(f"/api/stories/{one}/undo").status_code == 200
    assert client.get(f"/api/series/{s['id']}").json()["books"][0]["role"] == "She lights it."
    assert client.patch(f"/api/series/{s['id']}/books/nobody", json={"role": "x"}).status_code == 404


def test_a_planned_book_is_given_its_cast_later_in_one_undo(client, db_session, test_user):
    from tests.fixtures.series_factory import make_book

    one = make_book(db_session, test_user)
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.story.id]}).json()["id"]
    two = client.post(f"/api/series/{sid}/books", json={"title": "Two"}).json()["story_id"]

    r = client.post(
        f"/api/series/{sid}/books/{two}/carry",
        json={
            "source_story_id": one.story.id,
            "carry": [
                {"kind": "character", "ref_id": one.eleanor.id},
                {"kind": "location", "ref_id": one.lighthouse.id},
            ],
        },
    )
    assert r.status_code == 200, r.text
    names = {e["name"] for e in r.json()["elements"] if any(m["story_id"] == two for m in e["members"])}
    assert {"Eleanor", "The Lighthouse"} <= names

    # Again: what the book has is passed by.
    again = client.post(
        f"/api/series/{sid}/books/{two}/carry",
        json={"source_story_id": one.story.id, "carry": [{"kind": "character", "ref_id": one.eleanor.id}]},
    )
    assert again.status_code == 200
    from app.models import Character

    assert db_session.query(Character).filter(Character.story_id == two).count() == 1

    assert client.post(f"/api/stories/{two}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.query(Character).filter(Character.story_id == two).count() == 0
