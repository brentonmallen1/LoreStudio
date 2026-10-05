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


# ── Axes ─────────────────────────────────────────────────────────────────────────


def _findings(client, story_id, check):
    return [f for f in client.get(f"/api/stories/{story_id}/findings").json()["findings"] if f["check"] == check]


def _two_books_with_axes(client, db_session, test_user):
    from tests.fixtures.series_factory import make_book, scenes

    one = make_book(db_session, test_user)
    scenes(db_session, one.story, "The Light", "The Gap")
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.story.id]}).json()["id"]
    two = client.post(f"/api/series/{sid}/books", json={"title": "Two"}).json()["story_id"]
    axes = client.put(
        f"/api/series/{sid}/axes",
        json={
            "axes": [
                {"kind": "character", "label": "Viewpoint", "pov": True},
                {"kind": "era", "label": "Era"},
                {"kind": "character", "label": "Antagonist"},
            ]
        },
    ).json()["axes"]
    return sid, one, two, axes


def test_axes_and_each_books_place_on_them(client, db_session, test_user):
    sid, one, two, axes = _two_books_with_axes(client, db_session, test_user)
    view, era, foe = (a["id"] for a in axes)
    assert [a["pov"] for a in axes] == [True, False, False]

    r = client.patch(
        f"/api/series/{sid}/books/{one.story.id}",
        json={"slots": {view: {"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}}},
    )
    assert r.status_code == 200, r.text
    slot = r.json()["books"][0]["slots"][view]
    assert slot["text"] == "Eleanor" and slot["element_id"]
    assert any(e["id"] == slot["element_id"] for e in r.json()["elements"]), "shared with the series to stand there"

    # An idea in words, then the same element chosen for another book.
    r = client.patch(f"/api/series/{sid}/books/{two}", json={"slots": {era: {"text": "  The war years "}}})
    assert r.json()["books"][1]["slots"][era] == {"element_id": None, "text": "The war years"}
    r = client.patch(f"/api/series/{sid}/books/{two}", json={"slots": {view: {"element_id": slot["element_id"]}}})
    assert r.json()["books"][1]["slots"][view]["element_id"] == slot["element_id"]

    # The wrong kind, an unknown axis, and clearing one.
    bad = {"slots": {era: {"element_id": slot["element_id"]}}}
    assert client.patch(f"/api/series/{sid}/books/{two}", json=bad).status_code == 400
    assert client.patch(f"/api/series/{sid}/books/{two}", json={"slots": {"nope": {"text": "x"}}}).status_code == 404
    r = client.patch(f"/api/series/{sid}/books/{two}", json={"slots": {era: None}})
    assert era not in r.json()["books"][1]["slots"]

    # An axis taken out leaves every book.
    r = client.put(f"/api/series/{sid}/axes", json={"axes": [axes[1], axes[2]]})
    assert all(view not in b["slots"] for b in r.json()["books"])
    assert client.put(f"/api/series/{sid}/axes", json={"axes": [{"kind": "mood", "label": "x"}]}).status_code == 400
    assert foe


def test_a_book_missing_its_viewpoint_is_offered_it(client, db_session, test_user):
    sid, one, two, axes = _two_books_with_axes(client, db_session, test_user)
    view = axes[0]["id"]
    el = client.patch(
        f"/api/series/{sid}/books/{one.story.id}",
        json={"slots": {view: {"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}}},
    ).json()["books"][0]["slots"][view]["element_id"]
    client.patch(f"/api/series/{sid}/books/{two}", json={"slots": {view: {"element_id": el}}})

    [f] = _findings(client, two, "series-axis-missing")
    assert "Eleanor" in f["text"] and f["fix"]["kind"] == "carry"
    assert _findings(client, one.story.id, "series-axis-missing") == []
    assert any(g["check"] == "series-axis-missing" for g in client.get(f"/api/series/{sid}/findings").json())

    assert client.post(f"/api/stories/{two}/findings/{f['id']}/fix").status_code == 200
    assert _findings(client, two, "series-axis-missing") == []
    assert client.post(f"/api/stories/{two}/undo").status_code == 200
    assert len(_findings(client, two, "series-axis-missing")) == 1


def test_a_scene_told_by_someone_else_or_set_in_another_era_is_asked_about(client, db_session, test_user):
    from app.models import Era
    from app.models.structure import StructureNode

    sid, one, _, axes = _two_books_with_axes(client, db_session, test_user)
    view, era_axis, foe = (a["id"] for a in axes)
    client.patch(
        f"/api/series/{sid}/books/{one.story.id}",
        json={
            "slots": {
                view: {"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id},
                era_axis: {"kind": "era", "story_id": one.story.id, "ref_id": one.era.id},
                foe: {"kind": "character", "story_id": one.story.id, "ref_id": one.visitor.id},
            }
        },
    )
    light, gap = (
        db_session.query(StructureNode)
        .filter(StructureNode.story_id == one.story.id)
        .order_by(StructureNode.position)
        .all()
    )
    assert _findings(client, one.story.id, "series-axis-pov") == []

    # A scene with no POV of its own raises nothing; one told by the visitor does.
    light.pov_character_id = one.visitor.id
    war = Era(story_id=one.story.id, name="The War")
    db_session.add(war)
    db_session.flush()
    gap.era_id = war.id
    db_session.commit()
    [pov] = _findings(client, one.story.id, "series-axis-pov")
    assert "The Light" in pov["text"] and pov["anchor"]["node_id"] == light.id
    [era] = _findings(client, one.story.id, "series-axis-era")
    assert "The Gap" in era["text"] and "The Lamp Years" in era["text"]

    # The antagonist axis is not a point of view: the book's own POV is only checked against the viewpoint.
    one.story.pov_character_id = one.visitor.id
    db_session.commit()
    texts = [f["text"] for f in _findings(client, one.story.id, "series-axis-pov")]
    assert len(texts) == 2 and any("the book's point of view is The Visitor" in t for t in texts)


# ── Shapes ───────────────────────────────────────────────────────────────────────


def test_a_shape_starts_the_plan_and_changes_nothing_written(client, db_session, test_user):
    shapes = {s["id"]: s for s in client.get("/api/series-shapes").json()}
    assert {"duology", "trilogy", "saga", "viewpoint-cycle", "generational"} <= set(shapes)

    one = empty_book(db_session, test_user, "The Last Lighthouse")
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.id]}).json()["id"]
    client.patch(f"/api/series/{sid}/books/{one.id}", json={"role": "Mine already."})
    client.put(f"/api/series/{sid}/axes", json={"axes": [{"kind": "era", "label": "era"}]})

    r = client.post(f"/api/series/{sid}/shape", json={"shape_id": "generational"})
    assert r.status_code == 200, r.text
    s = r.json()
    assert [b["title"] for b in s["books"]] == ["The Last Lighthouse", "Book 2", "Book 3"]
    assert s["books"][0]["role"] == "Mine already."
    assert s["books"][1]["role"].startswith("The second")
    assert [b["name"] for b in s["arc"]] == shapes["generational"]["beats"]
    assert [len(b["arc_beats"]) for b in s["books"]] == [1, 1, 1]
    assert [(a["label"], a["pov"]) for a in s["axes"]] == [("era", False), ("Viewpoint", True)], "Era not doubled"

    assert client.post(f"/api/series/{sid}/shape", json={"shape_id": "trilogy"}).status_code == 409
    assert client.post(f"/api/series/{sid}/shape", json={"shape_id": "nope"}).status_code == 404


def test_a_shape_on_an_empty_series_makes_its_books(client):
    s = _new_series(client)
    out = client.post(f"/api/series/{s['id']}/shape", json={"shape_id": "viewpoint-cycle"}).json()
    assert len(out["books"]) == 4 and [b["arc_beats"] != [] for b in out["books"]] == [True, True, True, True]
