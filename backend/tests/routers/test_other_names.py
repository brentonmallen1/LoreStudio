"""Other names (aliases): a mention that names an entry by another name still finds it, and a
rename keeps the old name while the prose still says it."""

import uuid

from app.models.character import Character
from app.models.location import Location
from app.services.other_names import clean
from app.services.refactoring_service import apply_entity_rename
from tests.fixtures.findings_story import build_findings_story


def _place(db, story, name):
    loc = Location(id=str(uuid.uuid4()), story_id=story.id, name=name)
    db.add(loc)
    db.flush()
    return loc


def _eleanor(db, story):
    return db.query(Character).filter(Character.story_id == story.id, Character.name == "Eleanor Vance").one()


def test_clean_trims_dedupes_and_drops_the_own_name():
    assert clean(["  The  Cottage ", "the cottage", "", "Cottage", "Keeper's Cottage"], "Keeper's Cottage") == [
        "The Cottage",
        "Cottage",
    ]


def test_renaming_a_place_keeps_the_old_name_the_prose_uses(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    cottage = _place(db_session, story, "The Cottage")
    nodes["The Storm"].content = "<p>She ran back to [[The Cottage]] in the rain.</p>"
    db_session.commit()

    r = client.patch(f"/api/locations/{cottage.id}", json={"name": "Keeper's Cottage"})

    assert r.status_code == 200, r.text
    assert r.json()["aliases"] == ["The Cottage"]
    cast = {e["node_id"]: e for e in client.get(f"/api/stories/{story.id}/scene-cast").json()["scenes"]}
    assert cottage.id in cast[nodes["The Storm"].id]["location_ids"]

    # One Undo takes back the name and the alias together.
    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200
    db_session.expire_all()
    restored = db_session.get(Location, cottage.id)
    assert (restored.name, restored.aliases) == ("The Cottage", [])


def test_a_rename_the_prose_never_used_keeps_nothing(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    cottage = _place(db_session, story, "Keepers Cottage")
    db_session.commit()

    r = client.patch(f"/api/locations/{cottage.id}", json={"name": "Keeper's Cottage"})

    assert r.json()["aliases"] == []


def test_a_character_alias_puts_them_in_the_scene(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    nodes["The Storm"].content = "<p>@Nell held the rail as the storm came over the water.</p>"
    db_session.commit()

    r = client.patch(f"/api/characters/{eleanor.id}", json={"aliases": ["Nell", " nell ", "Eleanor Vance"]})

    assert r.status_code == 200, r.text
    assert r.json()["aliases"] == ["Nell"]
    cast = {e["node_id"]: e for e in client.get(f"/api/stories/{story.id}/scene-cast").json()["scenes"]}
    assert eleanor.id in cast[nodes["The Storm"].id]["character_ids"]


def test_renaming_rewrites_dialogue_tags_as_stored(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    scene = nodes["The Storm"]
    scene.content = '<p>"Hold on,"&lt;Eleanor Vance&gt; she said. @Eleanor Vance held on.</p>'
    db_session.commit()

    apply_entity_rename("character", "Eleanor Vance", "Nell \\1 Vance", [scene.id], db_session)

    assert scene.content == '<p>"Hold on,"&lt;Nell \\1 Vance&gt; she said. @Nell \\1 Vance held on.</p>'


def test_a_partial_rename_keeps_the_old_name_for_the_scenes_left_out(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    nodes["The Storm"].content = "<p>@Eleanor Vance held the rail.</p>"
    nodes["Supper"].content = "<p>@Eleanor Vance ate alone.</p>"
    db_session.commit()

    body = {"old_name": "Eleanor Vance", "new_name": "Nell Vance", "node_ids": [nodes["The Storm"].id]}
    r = client.post(f"/api/characters/{eleanor.id}/apply-rename", json=body)

    assert r.status_code == 200, r.text
    assert (r.json()["name"], r.json()["aliases"]) == ("Nell Vance", ["Eleanor Vance"])
