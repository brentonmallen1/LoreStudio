""" "Same as…": a found place folded into one the author has (doc 13 P4)."""

import uuid

from app.models.location import Location, SceneSetting
from app.models.location_travel import LocationTravel
from tests.fixtures.findings_story import build_findings_story


def _place(db, story, name, **kw):
    loc = Location(id=str(uuid.uuid4()), story_id=story.id, name=name, **kw)
    db.add(loc)
    db.flush()
    return loc


def _setup(db, user):
    story, nodes = build_findings_story(db, user)
    house = _place(db, story, "The Keeper's House")
    stub = _place(db, story, "Keeper's Cottage", is_stub=True)
    pantry = _place(db, story, "Pantry", parent_id=stub.id)
    harbour = _place(db, story, "Harbour")
    db.add_all(
        [
            SceneSetting(location_id=stub.id, node_id=nodes["Supper"].id),
            SceneSetting(location_id=stub.id, node_id=nodes["Arrival"].id),
            SceneSetting(location_id=house.id, node_id=nodes["Arrival"].id),
            LocationTravel(from_location_id=stub.id, to_location_id=harbour.id),
        ]
    )
    db.commit()
    return story, nodes, house, stub, pantry


def test_merging_moves_everything_and_keeps_the_name(client, db_session, test_user):
    story, nodes, house, stub, pantry = _setup(db_session, test_user)

    r = client.post(f"/api/locations/{stub.id}/merge", json={"into": house.id})

    assert r.status_code == 200, r.text
    assert r.json()["aliases"] == ["Keeper's Cottage"]
    db_session.expire_all()
    assert db_session.get(Location, stub.id) is None
    assert db_session.get(Location, pantry.id).parent_id == house.id
    settings = db_session.query(SceneSetting).filter(SceneSetting.location_id == house.id).all()
    # Arrival was set at both: one row, not two.
    assert sorted(s.node_id for s in settings) == sorted([nodes["Arrival"].id, nodes["Supper"].id])
    assert db_session.query(LocationTravel).one().from_location_id == house.id


def test_one_undo_puts_it_all_back(client, db_session, test_user):
    story, nodes, house, stub, pantry = _setup(db_session, test_user)
    client.post(f"/api/locations/{stub.id}/merge", json={"into": house.id})

    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200

    db_session.expire_all()
    restored = db_session.get(Location, stub.id)
    assert restored is not None and restored.is_stub
    assert db_session.get(Location, pantry.id).parent_id == stub.id
    assert db_session.get(Location, house.id).aliases == []
    assert db_session.query(SceneSetting).filter(SceneSetting.location_id == stub.id).count() == 2
    assert db_session.query(LocationTravel).one().from_location_id == stub.id


def test_the_alias_resolves_in_the_prose(client, db_session, test_user):
    story, nodes, house, stub, _ = _setup(db_session, test_user)
    nodes["The Storm"].content = "<p>She ran back to [[Keeper's Cottage]] in the rain.</p>"
    db_session.commit()
    client.post(f"/api/locations/{stub.id}/merge", json={"into": house.id})

    cast = {e["node_id"]: e for e in client.get(f"/api/stories/{story.id}/scene-cast").json()["scenes"]}

    assert house.id in cast[nodes["The Storm"].id]["location_ids"]


def test_a_place_cannot_merge_into_itself_or_what_is_inside_it(client, db_session, test_user):
    _, _, _, stub, pantry = _setup(db_session, test_user)

    assert client.post(f"/api/locations/{stub.id}/merge", json={"into": stub.id}).status_code == 422
    assert client.post(f"/api/locations/{stub.id}/merge", json={"into": pantry.id}).status_code == 422
