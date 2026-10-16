"""What you've written (doc 29 D6): who and where the prose names, new names, the tidy-up offers,
"Not now" kept per story, and a scene's first line in the Outline."""

import uuid

from app.models import ActivityLog, Location, User
from tests.fixtures.findings_story import build_findings_story

LONG = "".join(f"<p>{'The sea was grey and the lamp turned all night long. ' * 25}</p>" for _ in range(10))


def _written(client, story):
    r = client.get(f"/api/stories/{story.id}/written")
    assert r.status_code == 200, r.text
    return r.json()


def test_people_and_places_by_how_often_the_prose_names_them(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    db_session.add(Location(id=str(uuid.uuid4()), story_id=story.id, name="The Point"))
    db_session.add(Location(id=str(uuid.uuid4()), story_id=story.id, name="Nowhere"))
    # A speaker tag says who speaks; it is not the prose naming her.
    nodes["The Letter"].content += "<p>“Burn it.”&lt;Margaret Holt&gt;</p>"
    db_session.commit()
    out = _written(client, story)
    people = {p["name"]: p for p in out["people"]}
    # "Eleanor" five times (the misspelt "Elenor" is not her); Margaret once.
    assert (people["Eleanor Vance"]["times"], people["Eleanor Vance"]["scenes"]) == (5, 5)
    assert people["Margaret Holt"]["times"] == 1
    assert [p["name"] for p in out["people"]] == ["Eleanor Vance", "Margaret Holt"]
    # A place the prose never names is left out.
    assert [(p["name"], p["times"]) for p in out["places"]] == [("The Point", 1)]


def test_new_names_from_the_scan_with_the_discoveries_yes_and_no(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content += "<p>Gull came by. Gull stayed. Gull left at dawn.</p>"
    result = {
        "character_suggestions": [
            {"text": "Gull", "label": "PERSON", "occurrences": 3, "scene_ids": [nodes["Supper"].id]},
            {"text": "Eleanor", "label": "PERSON", "occurrences": 9},
        ],
        "location_suggestions": [],
    }
    db_session.add(
        ActivityLog(
            user_id=test_user.id,
            story_id=story.id,
            event_type="analysis_run",
            category="health",
            description="scan",
            metadata_={"feature": "entity-suggestions", "result": result},
        )
    )
    db_session.commit()
    out = _written(client, story)
    assert out["last_scan"] is not None
    [gull] = out["new_names"]
    assert (gull["name"], gull["kind"], gull["times"], gull["add_action"]) == ("Gull", "person", 3, "add")
    feed = client.get(f"/api/stories/{story.id}/proposals").json()["proposals"]
    assert next(p for p in feed if p["id"] == gull["proposal_id"])["decline"] == "Not a person"
    assert client.post(f"/api/stories/{story.id}/proposals/{gull['proposal_id']}/decline").status_code == 204
    assert _written(client, story)["new_names"] == []


def test_a_long_scene_where_the_time_jumps_is_offered_a_split_until_not_now(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    storm = nodes["The Storm"]
    storm.content = LONG + "<p>By morning the storm had gone.</p>" + LONG
    storm.word_count = 2 * 2500 + 6
    db_session.commit()
    [offer] = _written(client, story)["split_offers"]
    assert (offer["node_id"], offer["title"], offer["long_scene_words"]) == (storm.id, "The Storm", 2500)
    assert [j["phrase"] for j in offer["jumps"]] == ["By morning"]
    assert client.get(f"/api/structure/{storm.id}/split-offer").json()["node_id"] == storm.id
    # A scene that is not long is not offered one.
    assert client.get(f"/api/structure/{nodes['Supper'].id}/split-offer").json() is None

    r = client.post(f"/api/stories/{story.id}/written/not-now", json={"key": f"split:{storm.id}"})
    assert r.status_code == 204
    assert _written(client, story)["split_offers"] == []
    assert client.get(f"/api/structure/{storm.id}/split-offer").json() is None
    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200
    assert len(_written(client, story)["split_offers"]) == 1


def test_not_now_only_for_an_offer(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/written/not-now", json={"key": "anything at all"})
    assert r.status_code == 400


def test_a_scene_with_words_and_no_line_shows_its_first_line_in_the_outline(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Arrival"].synopsis = ""
    nodes["Supper"].synopsis = "Eleanor eats alone."
    db_session.commit()
    tree = client.get(f"/api/stories/{story.id}/structure").json()
    scenes = {s["title"]: s for c in tree for s in c["children"]}
    assert scenes["Arrival"]["first_line"] == "Eleanor climbed the stairs while Margaret watched from the door."
    assert scenes["Supper"]["first_line"] == ""
    assert next(c for c in tree if c["title"] == "Chapter 3")["first_line"] == ""


def test_another_writers_story_is_not_read(client, db_session):
    stranger = User(
        id=str(uuid.uuid4()), username="other", password_hash="x", display_name="O", is_admin=False, settings={}
    )
    db_session.add(stranger)
    db_session.flush()
    story, nodes = build_findings_story(db_session, stranger)
    assert client.get(f"/api/stories/{story.id}/written").status_code == 404
    assert client.get(f"/api/structure/{nodes['Supper'].id}/split-offer").status_code == 404
    assert client.post(f"/api/stories/{story.id}/written/not-now", json={"key": "split:x"}).status_code == 404


def test_a_name_found_as_a_person_and_a_place_is_counted_as_each(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content += "<p>Delia waved. Delia sat. At Marlowe’s the coffee was cold.</p>"
    db_session.add(Location(id=str(uuid.uuid4()), story_id=story.id, name="Marlowe’s"))
    result = {
        "character_suggestions": [
            {"text": "Delia", "label": "PERSON", "occurrences": 2},
            {"text": "Marlowe", "label": "PERSON", "occurrences": 2},
        ],
        "location_suggestions": [{"text": "Delia", "label": "GPE", "occurrences": 2}],
    }
    db_session.add(
        ActivityLog(
            user_id=test_user.id,
            story_id=story.id,
            event_type="analysis_run",
            category="health",
            description="scan",
            metadata_={"feature": "entity-suggestions", "result": result},
        )
    )
    db_session.commit()
    found = {(n["name"], n["kind"]): n["times"] for n in _written(client, story)["new_names"]}
    # "Marlowe’s" is in Places, so the scan's "Marlowe" is not someone new.
    assert found == {("Delia", "person"): 2, ("Delia", "place"): 2}
