"""What you've written (doc 29 D6): who and where the prose names, new names, the tidy-up offers,
"Not now" kept per story, and a scene's first line in the Outline."""

import uuid

from app.models import ActivityLog, Location, StructureNode, User
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
    assert (gull["name"], gull["kind"], gull["times"]) == ("Gull", "person", 3)
    assert (gull["actions"], gull["decline"]) == ([{"id": "add", "label": "Add as a person"}], "Not a person")
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


def _scan(db_session, test_user, story, result):
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


def test_a_name_found_as_a_person_and_a_place_is_asked_once(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content += "<p>Delia waved. Delia sat. At Marlowe’s the coffee was cold. Delia left.</p>"
    db_session.add(Location(id=str(uuid.uuid4()), story_id=story.id, name="Marlowe’s"))
    _scan(
        db_session,
        test_user,
        story,
        {
            "character_suggestions": [
                {"text": "Delia", "label": "PERSON", "occurrences": 2},
                {"text": "Marlowe", "label": "PERSON", "occurrences": 2},
            ],
            "location_suggestions": [{"text": "Delia", "label": "GPE", "occurrences": 3}],
        },
    )
    # "Marlowe’s" is in Places, so the scan's "Marlowe" is not someone new; "Delia" shows once,
    # as the place the scan read her as more often, with both yeses and "Neither".
    [delia] = _written(client, story)["new_names"]
    assert (delia["name"], delia["kind"], delia["times"], delia["decline"]) == ("Delia", "place", 3, "Neither")
    assert [a["label"] for a in delia["actions"]] == ["Add as a person", "Add as a place"]
    feed = [
        p
        for p in client.get(f"/api/stories/{story.id}/proposals").json()["proposals"]
        if p["kind"] in ("person", "place")
    ]
    assert [(p["subject"], p["decline"]) for p in feed] == [("Delia", "Neither")]

    # "Add as a person" makes her a character, whichever list she showed in.
    r = client.post(f"/api/stories/{story.id}/proposals/{delia['proposal_id']}/act", json={"action": "person"})
    assert r.status_code == 200, r.text
    assert r.json()["entity_type"] == "character"
    assert _written(client, story)["new_names"] == []


def test_neither_declines_a_name_as_both(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    nodes["Supper"].content += "<p>Delia waved. Delia sat.</p>"
    found = {"text": "Delia", "occurrences": 2}
    _scan(
        db_session,
        test_user,
        story,
        {"character_suggestions": [{**found, "label": "PERSON"}], "location_suggestions": [{**found, "label": "GPE"}]},
    )
    [delia] = _written(client, story)["new_names"]
    assert delia["kind"] == "person"  # a tie is a person
    assert client.post(f"/api/stories/{story.id}/proposals/{delia['proposal_id']}/decline").status_code == 204
    assert _written(client, story)["new_names"] == []
    # Declining it as both: a later scan that reads her as a place more often asks nothing.
    _scan(
        db_session,
        test_user,
        story,
        {"character_suggestions": [], "location_suggestions": [{**found, "label": "GPE", "occurrences": 5}]},
    )
    assert _written(client, story)["new_names"] == []
    # One ⌘Z brings the question back.
    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200
    assert [n["name"] for n in _written(client, story)["new_names"]] == ["Delia"]


def test_a_part_holding_many_scenes_is_offered_chapters_until_not_now(client, db_session, test_user):
    from app.models.structure import StoryStructureTemplate
    from app.services.seed import STRUCTURE_TEMPLATES

    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    story, nodes = build_findings_story(db_session, test_user)
    held = nodes["Chapter 3"]
    for i in range(8):
        db_session.add(
            StructureNode(story_id=story.id, parent_id=held.id, level=1, level_type="scene", title=f"S{i}", position=i)
        )
    db_session.commit()
    [offer] = _written(client, story)["chapters_offers"]
    assert (offer["part_id"], offer["scenes"], offer["level"], offer["many_scenes"]) == (held.id, 8, "section", 8)
    client.post(f"/api/stories/{story.id}/written/not-now", json={"key": f"chapters:{held.id}"})
    assert _written(client, story)["chapters_offers"] == []


def test_a_scene_made_with_words_counts_them(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    r = client.post(
        f"/api/stories/{story.id}/structure",
        json={
            "parent_id": nodes["Chapter 3"].id,
            "level": 1,
            "level_type": "scene",
            "title": "From Freewrite",
            "content": "<p>The logbook lay open at the missing week.</p>",
            "status": "draft",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["word_count"] == 8
