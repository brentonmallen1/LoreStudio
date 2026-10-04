"""Writing the next book: the series made on the way, and who carries over."""

from app.models import Character, CharacterRelationship, Location, Story
from app.services.series import service
from tests.fixtures.series_factory import make_book


def _sequel(client, story_id, carry, **extra):
    r = client.post(f"/api/stories/{story_id}/sequel", json={"title": "The Keeper's Daughter", "carry": carry, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_a_sequel_to_a_standalone_book_starts_the_series(client, db_session, test_user):
    one = make_book(db_session, test_user)
    one.story.genre = "Gothic"
    one.story.themes = ["inheritance"]
    one.story.narrative_perspective = "close third"
    one.story.logline = "Not carried: every book has its own."
    db_session.commit()

    out = _sequel(
        client,
        one.story.id,
        [
            {"kind": "character", "ref_id": one.eleanor.id},
            {"kind": "character", "ref_id": one.visitor.id},
            {"kind": "location", "ref_id": one.lighthouse.id},
            {"kind": "location", "ref_id": one.coast.id},
        ],
    )

    series = client.get(f"/api/series/{out['series_id']}").json()
    assert series["name"] == "The Last Lighthouse"
    assert [b["title"] for b in series["books"]] == ["The Last Lighthouse", "The Keeper's Daughter"]
    assert {e["name"] for e in series["elements"]} == {"Eleanor", "The Visitor", "The Lighthouse", "The Coast"}
    assert all(len(e["members"]) == 2 for e in series["elements"])

    new = db_session.get(Story, out["id"])
    assert new.genre == "Gothic" and new.themes == ["inheritance"] and new.narrative_perspective == "close third"
    assert new.logline == ""

    chars = {c.name: c for c in db_session.query(Character).filter(Character.story_id == new.id)}
    assert chars["Eleanor"].background == one.eleanor.background
    rel = (
        db_session.query(CharacterRelationship).filter(CharacterRelationship.character_id == chars["Eleanor"].id).one()
    )
    assert rel.related_character_id == chars["The Visitor"].id

    places = {p.name: p for p in db_session.query(Location).filter(Location.story_id == new.id)}
    assert places["The Lighthouse"].parent_id == places["The Coast"].id, "parents first, whatever the order sent"

    assert client.get(f"/api/stories/{new.id}/undo/state").json()["can_undo"] is False


def test_a_sequel_goes_right_after_its_book_and_can_bring_elements_that_book_lacks(client, db_session, test_user):
    one = make_book(db_session, test_user)
    db_session.commit()
    two = _sequel(client, one.story.id, [{"kind": "character", "ref_id": one.eleanor.id}])
    three = _sequel(client, two["id"], [], title="Book Three")
    # Book two to book three was the order; a sequel to book one lands between them.
    between = _sequel(client, one.story.id, [], title="An Interlude")
    titles = [b["title"] for b in client.get(f"/api/series/{two['series_id']}").json()["books"]]
    assert titles == ["The Last Lighthouse", "An Interlude", "The Keeper's Daughter", "Book Three"]

    # Book three never had the visitor's chain; share him from book one, then carry him on.
    series = client.post(
        f"/api/series/{two['series_id']}/elements",
        json={"kind": "character", "story_id": one.story.id, "ref_id": one.visitor.id},
    ).json()
    visitor = next(e for e in series["elements"] if e["name"] == "The Visitor")
    candidates = client.get(f"/api/stories/{three['id']}/carry-over").json()
    offered = next(c for c in candidates if c["element_id"] == visitor["id"])
    assert offered["ref_id"] is None and offered["in_series"] is True

    four = _sequel(client, three["id"], [{"element_id": visitor["id"]}], title="Book Four")
    assert (
        db_session.query(Character).filter(Character.story_id == four["id"], Character.name == "The Visitor").count()
        == 1
    )
    assert between["series_id"] == two["series_id"]


def test_carry_over_lists_every_kind_and_says_what_is_shared(client, db_session, test_user):
    one = make_book(db_session, test_user)
    db_session.commit()
    candidates = client.get(f"/api/stories/{one.story.id}/carry-over").json()
    assert {c["kind"] for c in candidates} == {"character", "location", "era", "historical_event"}
    storm = next(c for c in candidates if c["name"] == "The Great Storm")
    assert storm["lore_kind"] == "event" and storm["in_series"] is False
    lighthouse = next(c for c in candidates if c["name"] == "The Lighthouse")
    assert lighthouse["parent_ref_id"] == one.coast.id


def test_a_sequel_refuses_rows_from_another_book(client, db_session, test_user):
    one = make_book(db_session, test_user)
    other = make_book(db_session, test_user, "Elsewhere")
    db_session.commit()
    r = client.post(
        f"/api/stories/{one.story.id}/sequel",
        json={"title": "Next", "carry": [{"kind": "character", "ref_id": other.eleanor.id}]},
    )
    assert r.status_code == 404
    assert client.post(f"/api/stories/{one.story.id}/sequel", json={"title": "  "}).status_code == 400
    assert service.membership(db_session, one.story.id) is None, "nothing half-made"
