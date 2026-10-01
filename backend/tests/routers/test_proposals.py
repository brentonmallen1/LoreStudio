"""The Proposals inbox (doc 12 P5): every source, yes, no, undo, and declines that lapse."""

import uuid

from app.models import ActivityLog, Character, CharacterRelationship, DiscoveredElement, Location
from tests.fixtures.findings_story import build_findings_story


def _feed(client, story):
    r = client.get(f"/api/stories/{story.id}/proposals")
    assert r.status_code == 200, r.text
    return {p["id"]: p for p in r.json()["proposals"]}


def _uid():
    return str(uuid.uuid4())


def test_a_stub_place_is_kept_and_the_keep_undoes(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    stub = Location(id=_uid(), story_id=story.id, name="The Mainland", is_stub=True)
    db_session.add(stub)
    db_session.commit()
    p = _feed(client, story)[f"stub:{stub.id}"]
    assert (p["kind"], p["source"], p["decline"]) == ("place", "local", "Not a place")
    r = client.post(f"/api/stories/{story.id}/proposals/stub:{stub.id}/act", json={"action": "keep"})
    assert r.json() == {"entity_type": "location", "entity_id": stub.id, "open": None}
    db_session.refresh(stub)
    assert stub.is_stub is False and f"stub:{stub.id}" not in _feed(client, story)
    assert client.post(f"/api/stories/{story.id}/undo").status_code == 200
    db_session.refresh(stub)
    assert stub.is_stub is True


def test_not_a_place_deletes_the_stub_undoably(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    stub = Location(id=_uid(), story_id=story.id, name="Gullrock", is_stub=True)
    db_session.add(stub)
    db_session.commit()
    sid = stub.id
    assert client.post(f"/api/stories/{story.id}/proposals/stub:{sid}/decline").status_code == 204
    db_session.expire_all()
    assert db_session.get(Location, sid) is None
    client.post(f"/api/stories/{story.id}/undo")
    db_session.expire_all()
    assert db_session.get(Location, sid) is not None


def test_a_discovered_character_becomes_one(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    d = DiscoveredElement(
        id=_uid(), story_id=story.id, element_type="character", name="Gull", source_node_id=nodes["Supper"].id
    )
    db_session.add(d)
    db_session.commit()
    p = _feed(client, story)[f"discovery:{d.id}"]
    assert (p["kind"], p["source"], p["where"]) == ("person", "ai", "Supper")
    r = client.post(f"/api/stories/{story.id}/proposals/discovery:{d.id}/act", json={"action": "approve"}).json()
    assert r["entity_type"] == "character"
    assert db_session.get(Character, r["entity_id"]).name == "Gull"
    db_session.refresh(d)
    assert d.status == "approved"


def test_declining_a_discovery_rejects_it(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    d = DiscoveredElement(id=_uid(), story_id=story.id, element_type="theme", name="Solitude")
    db_session.add(d)
    db_session.commit()
    assert _feed(client, story)[f"discovery:{d.id}"]["kind"] == "fact"
    client.post(f"/api/stories/{story.id}/proposals/discovery:{d.id}/decline")
    db_session.refresh(d)
    assert d.status == "rejected" and f"discovery:{d.id}" not in _feed(client, story)


def test_a_suggested_relationship(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    el, mg = sorted(story.characters, key=lambda c: c.name)
    rel = CharacterRelationship(
        id=_uid(), character_id=el.id, related_character_id=mg.id, relationship_type="old_friend", is_suggested=True
    )
    db_session.add(rel)
    db_session.commit()
    p = _feed(client, story)[f"rel:{rel.id}"]
    assert p["text"] == "Eleanor Vance and Margaret Holt: old friend"
    client.post(f"/api/stories/{story.id}/proposals/rel:{rel.id}/act", json={"action": "accept"})
    db_session.refresh(rel)
    assert rel.is_suggested is False


def test_dialogue_without_a_speaker_declines_until_the_scene_changes(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp = nodes["The Lamp"]
    # Counted from the prose by the tagger's own detector (doc 13 P4), not from stored rows.
    lamp.content = "<p>“Is the lamp lit?”</p><p>“Not yet,” came the answer.</p>"
    db_session.commit()
    pid = f"dialogue:{lamp.id}"
    p = _feed(client, story)[pid]
    assert (p["text"], p["where"], p["decline"]) == ("2 lines of dialogue with no speaker", "The Lamp", "Leave them")
    assert "Is the lamp lit?" in p["evidence"]
    assert client.post(f"/api/stories/{story.id}/proposals/{pid}/act", json={"action": "tag"}).json()["open"] == lamp.id
    client.post(f"/api/stories/{story.id}/proposals/{pid}/decline")
    assert pid not in _feed(client, story)
    lamp.content += "<p>“Who’s there?”</p>"
    db_session.commit()
    assert pid in _feed(client, story)


def test_names_from_the_scan_skip_what_the_lorebook_has(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    result = {
        "character_suggestions": [
            {
                "text": "Gull",
                "label": "PERSON",
                "occurrences": 3,
                "scene_ids": [nodes["Supper"].id],
                "scene_titles": ["Supper"],
            },
            {"text": "Eleanor", "label": "PERSON", "occurrences": 9},
            {"text": "@Margaret Holt", "label": "PERSON", "occurrences": 2},
            {"text": "Holt>", "label": "PERSON", "occurrences": 1},
        ],
        "location_suggestions": [{"text": "Point Reyes", "label": "GPE", "occurrences": 1}],
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
    names = {p["subject"]: p for p in _feed(client, story).values() if p["id"].startswith("name:")}
    assert set(names) == {"Gull", "Point Reyes"}
    assert names["Gull"]["text"] == "Gull, named 3 times"
    r = client.post(f"/api/stories/{story.id}/proposals/{names['Gull']['id']}/act", json={"action": "add"}).json()
    assert db_session.get(Character, r["entity_id"]).name == "Gull"
    # Declining a name keeps it out.
    reyes = names["Point Reyes"]["id"]
    client.post(f"/api/stories/{story.id}/proposals/{reyes}/decline")
    assert reyes not in _feed(client, story)


def test_the_inbox_reads_front_to_back(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    for title in ("The Letter", "Arrival", "Supper"):
        nodes[title].content += "<p>“Who is it?”</p>"
    db_session.commit()
    order = [p["where"] for p in _feed(client, story).values()]
    assert order == ["Arrival", "Supper", "The Letter"]


def test_look_again_runs_the_scan(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/proposals/refresh", json={"ai": False})
    assert r.status_code == 200, r.text
    assert r.json()["job_id"] is None and r.json()["last_scan"] is not None


def test_wrong_action_unknown_id_and_privacy(client, db_session, test_user):
    from app.models.user import User

    story, _ = build_findings_story(db_session, test_user)
    stub = Location(id=_uid(), story_id=story.id, name="X", is_stub=True)
    db_session.add(stub)
    db_session.commit()
    assert (
        client.post(f"/api/stories/{story.id}/proposals/stub:{stub.id}/act", json={"action": "add"}).status_code == 422
    )
    assert client.post(f"/api/stories/{story.id}/proposals/stub:nope/act", json={"action": "keep"}).status_code == 404
    other = User(username="someone-else", display_name="S", password_hash="x")
    db_session.add(other)
    db_session.commit()
    theirs, _ = build_findings_story(db_session, other)
    assert client.get(f"/api/stories/{theirs.id}/proposals").status_code == 404


def _scan(db_session, test_user, story, feature, result):
    db_session.add(
        ActivityLog(
            user_id=test_user.id,
            story_id=story.id,
            event_type="analysis_run",
            category="health",
            description="scan",
            metadata_={"feature": feature, "result": result},
        )
    )
    db_session.commit()


def test_a_common_word_at_the_start_of_a_sentence_is_not_a_name(client, db_session, test_user):
    """doc 13 P4: "Barometer" was proposed as a character; the prose says "barometer" too."""
    story, nodes = build_findings_story(db_session, test_user)
    nodes["The Storm"].content = "<p>Barometer readings fell. She tapped the barometer twice.</p>"
    db_session.commit()
    _scan(
        db_session,
        test_user,
        story,
        "entity-suggestions",
        {
            "character_suggestions": [
                {"text": "Barometer", "label": "PERSON", "occurrences": 4},
                {"text": "Gull", "label": "PERSON", "occurrences": 1},
                {"text": "Thomas Mull", "label": "PERSON", "occurrences": 1},
                {"text": "Gannet", "label": "PERSON", "occurrences": 2},
            ]
        },
    )
    names = {p["subject"] for p in _feed(client, story).values() if p["id"].startswith("name:")}
    # One word used once is too thin to propose; a full name used once is not.
    assert names == {"Thomas Mull", "Gannet"}


def test_the_reader_knowledge_scan_proposes_and_a_yes_undoes(client, db_session, test_user):
    from app.models.reader_knowledge import ReaderKnowledgeEvent

    story, nodes = build_findings_story(db_session, test_user)
    _scan(
        db_session,
        test_user,
        story,
        "reader-knowledge-scan",
        {
            "events": [
                {
                    "node_id": nodes["The Letter"].id,
                    "knowledge_type": "clue_planted",
                    "subject": "The letter is burned",
                },
                {"node_id": None, "knowledge_type": "truth_revealed", "subject": "Eleanor was adopted"},
            ]
        },
    )
    feed = {p["subject"]: p for p in _feed(client, story).values() if p["id"].startswith("rk:")}
    assert set(feed) == {"The letter is burned", "Eleanor was adopted"}
    clue = feed["The letter is burned"]
    assert clue["text"] == "A clue: The letter is burned"
    assert clue["where"] == "The Letter"

    client.post(f"/api/stories/{story.id}/proposals/{clue['id']}/act", json={"action": "add"})
    event = db_session.query(ReaderKnowledgeEvent).one()
    assert (event.node_id, event.knowledge_type) == (nodes["The Letter"].id, "clue_planted")
    assert clue["id"] not in _feed(client, story)

    client.post(f"/api/stories/{story.id}/undo")
    db_session.expire_all()
    assert db_session.query(ReaderKnowledgeEvent).count() == 0
    assert clue["id"] in _feed(client, story)


def test_the_scan_writes_nothing_and_drops_scenes_the_model_made_up(client, db_session, test_user, mock_ai_gateway):
    from app.models.reader_knowledge import ReaderKnowledgeEvent

    story, nodes = build_findings_story(db_session, test_user)
    for n in nodes.values():
        n.synopsis = "Something happens."
    db_session.commit()
    mock_ai_gateway(
        structured_data={
            "events": [
                {"node_id": "not-a-scene", "subject": "A made-up place", "knowledge_type": "nonsense"},
                {"node_id": nodes["Arrival"].id, "subject": "Margaret is watching"},
            ]
        }
    )

    assert client.post(f"/api/stories/{story.id}/reader-knowledge/scan").json() == {"proposed": 2}

    assert db_session.query(ReaderKnowledgeEvent).count() == 0
    feed = {p["subject"]: p for p in _feed(client, story).values() if p["id"].startswith("rk:")}
    assert feed["A made-up place"]["node_id"] is None
    assert feed["A made-up place"]["text"].startswith("The reader learns")
    assert feed["Margaret is watching"]["node_id"] == nodes["Arrival"].id
