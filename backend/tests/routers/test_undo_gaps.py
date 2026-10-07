"""Routes that changed a story without recording it, now undoable (doc 23 P5).

One test per router: make the change, Undo, and the story is as it was. Redo where the change
is a delete or a prose rewrite, since those are the ones that carry rows or words back.
tests/test_undo_coverage.py keeps every route either recording or listed with its reason.
"""

import pytest

from app.models.activity_log import ActivityLog
from app.models.interview import CharacterInterview
from app.models.media import StoryAsset
from app.models.note import Note

H = {"X-Client-Id": "tab-1"}


def _story(client):
    return client.post("/api/stories", json={"title": "T"}).json()["id"]


def _undo(client, sid) -> str:
    r = client.post(f"/api/stories/{sid}/undo", headers=H)
    assert r.status_code == 200, r.text
    return r.json()["label"]


def _redo(client, sid) -> None:
    assert client.post(f"/api/stories/{sid}/redo", headers=H).status_code == 200


def _character(client, sid, name="Mara"):
    r = client.post(f"/api/stories/{sid}/characters", json={"name": name}, headers=H)
    assert r.status_code == 201, r.text
    return r.json()


def _scene(client, sid, content="<p>Hi</p>", title="Lamp"):
    body = {"title": title, "level": 0, "level_type": "scene", "content": content}
    return client.post(f"/api/stories/{sid}/structure", json=body, headers=H).json()


def _location(client, sid, name):
    return client.post(f"/api/stories/{sid}/locations", json={"name": name}, headers=H).json()


def _content(client, node_id) -> str:
    return client.get(f"/api/structure/{node_id}").json()["content"]


# ── Stories: a character, goals ──────────────────────────────────────────────────


def test_new_character_from_the_story_undoes(client):
    sid = _story(client)
    c = _character(client, sid)
    assert _undo(client, sid) == "Add character Mara"
    assert client.get(f"/api/characters/{c['id']}").status_code == 404
    _redo(client, sid)
    assert client.get(f"/api/characters/{c['id']}").json()["name"] == "Mara"


def test_goals_add_edit_reorder_delete_each_undo(client):
    sid = _story(client)
    url = f"/api/stories/{sid}/goals"
    a = client.post(url, json={"text": "Finish act one"}, headers=H).json()["goals"][0]
    b = client.post(url, json={"text": "Name the town"}, headers=H).json()["goals"][1]

    def goals():
        return client.get(f"/api/stories/{sid}").json()["goals"]

    client.patch(f"{url}/{a['id']}", json={"completed": True}, headers=H)
    assert _undo(client, sid) == "Complete goal “Finish act one”"
    assert goals()[0]["completed"] is False
    client.patch(f"{url}/reorder", json=[b["id"], a["id"]], headers=H)
    assert _undo(client, sid) == "Reorder goals"
    assert [g["id"] for g in goals()] == [a["id"], b["id"]]
    client.delete(f"{url}/{a['id']}", headers=H)
    assert _undo(client, sid) == "Delete goal “Finish act one”"
    assert [g["text"] for g in goals()] == ["Finish act one", "Name the town"]
    assert _undo(client, sid) == "Add goal “Name the town”"
    assert len(goals()) == 1


# ── Characters: milestones, discovery notes, mentions, relationships ────────────


@pytest.mark.parametrize(
    ("path", "field", "body", "patch"),
    [
        (
            "milestones",
            "arc_milestones",
            {"id": "", "text": "Leaves home"},
            {"id": "", "text": "Leaves", "completed": True},
        ),
        ("discovery-notes", "discovery_notes", {"text": "Hates boats"}, {"confirmed": True}),
    ],
)
def test_character_lists_undo(client, path, field, body, patch):
    sid = _story(client)
    c = _character(client, sid)
    url = f"/api/characters/{c['id']}/{path}"
    item = client.post(url, json=body, headers=H).json()[field][0]
    before = dict(item)
    client.patch(f"{url}/{item['id']}", json=patch, headers=H)
    assert _undo(client, sid).startswith("Edit" if path == "milestones" else "Confirm")
    assert client.get(f"/api/characters/{c['id']}").json()[field] == [before]
    client.delete(f"{url}/{item['id']}", headers=H)
    _undo(client, sid)
    assert client.get(f"/api/characters/{c['id']}").json()[field] == [before]
    assert _undo(client, sid).startswith("Add")
    assert client.get(f"/api/characters/{c['id']}").json()[field] == []


def test_applied_mentions_undo_in_every_scene(client):
    sid = _story(client)
    c = _character(client, sid)
    n = _scene(client, sid, "<p>Mara lit the lamp.</p>")
    body = {"scenes": [{"scene_id": n["id"], "proposals": [{"id": "p1", "matched_text": "Mara"}]}]}
    assert client.post(f"/api/characters/{c['id']}/apply-mentions", json=body, headers=H).json()["updated_scenes"] == 1
    assert _content(client, n["id"]) != "<p>Mara lit the lamp.</p>"
    assert _undo(client, sid) == "Link mentions of Mara"
    assert _content(client, n["id"]) == "<p>Mara lit the lamp.</p>"


def test_relationship_from_template_and_accepting_a_suggestion_undo(client, db_session):
    sid = _story(client)
    a, b = _character(client, sid, "Mara"), _character(client, sid, "Tom")
    templates = client.get("/api/characters/relationships/templates").json()
    body = {"related_character_id": b["id"], "template_id": templates[0]["id"]}
    rel = client.post(f"/api/characters/{a['id']}/relationships/from-template", json=body, headers=H).json()
    assert _undo(client, sid) == "Add relationship from Mara"
    assert client.get(f"/api/characters/{a['id']}/relationships").json() == []
    _redo(client, sid)
    from app.models.character import CharacterRelationship

    db_session.get(CharacterRelationship, rel["id"]).is_suggested = True
    db_session.commit()
    client.post(f"/api/characters/relationships/{rel['id']}/accept-suggestion", headers=H)
    assert _undo(client, sid) == "Accept suggested relationship from Mara"
    assert client.get(f"/api/characters/{a['id']}/relationships").json()[0]["is_suggested"] is True


def test_interview_notes_applied_to_the_sheet_undo(client, db_session):
    sid = _story(client)
    c = _character(client, sid)
    interview = CharacterInterview(character_id=c["id"], title="First talk")
    db_session.add(interview)
    db_session.commit()
    body = {"fields": ["background", "story_id"], "content": {"background": "Grew up at sea", "story_id": "x"}}
    r = client.post(f"/api/interviews/{interview.id}/apply-to-character", json=body, headers=H)
    assert r.json()["background"] == "Grew up at sea" and r.json()["story_id"] == sid  # never the story
    assert _undo(client, sid) == "Add background from the interview to Mara"
    assert client.get(f"/api/characters/{c['id']}").json()["background"] == ""


# ── Places: routes, scene settings, the old settings ─────────────────────────────


def test_travel_routes_undo_and_come_back_with_their_place(client):
    sid = _story(client)
    port, keep = _location(client, sid, "Port"), _location(client, sid, "Keep")
    body = {"from_location_id": port["id"], "to_location_id": keep["id"], "travel_time": "2 days"}
    t = client.post("/api/location-travel", json=body, headers=H).json()

    def routes():
        return client.get(f"/api/stories/{sid}/location-travel").json()

    client.patch(f"/api/location-travel/{t['id']}", json={"travel_time": "3 days"}, headers=H)
    assert _undo(client, sid) == "Edit travel_time on route Port to Keep"
    assert routes()[0]["travel_time"] == "2 days"
    client.delete(f"/api/location-travel/{t['id']}", headers=H)
    assert _undo(client, sid) == "Delete route Port to Keep"
    assert len(routes()) == 1
    # Deleting a place takes its routes (a cascade); undoing it brings them back.
    client.delete(f"/api/locations/{keep['id']}", headers=H)
    assert routes() == []
    _undo(client, sid)
    assert [r["id"] for r in routes()] == [t["id"]]
    _undo(client, sid)  # the route's own creation
    assert routes() == []


def test_scene_settings_undo(client):
    sid = _story(client)
    loc, n = _location(client, sid, "Port"), _scene(client, sid)
    body = {"location_id": loc["id"], "node_id": n["id"]}
    s = client.post("/api/scene-settings", json=body, headers=H).json()
    client.patch(f"/api/scene-settings/{s['id']}", json={"role": "flashback", "id": "nope"}, headers=H)
    assert _undo(client, sid) == "Edit role of Port in “Lamp”"
    assert client.get(f"/api/structure/{n['id']}/scene-settings").json()[0]["role"] == "primary"
    client.delete(f"/api/scene-settings/{s['id']}", headers=H)
    assert _undo(client, sid) == "Take “Lamp” out of Port"
    assert _undo(client, sid) == "Set “Lamp” in Port"
    assert client.get(f"/api/structure/{n['id']}/scene-settings").json() == []


def test_settings_migration_is_one_undo(client, db_session):
    from app.models.setting import Setting

    sid = _story(client)
    db_session.add(Setting(story_id=sid, name="Harbour", description="Salt"))
    db_session.commit()
    assert client.post(f"/api/stories/{sid}/locations/migrate-settings", headers=H).json()["created"] == 1
    assert _undo(client, sid) == "Make places of the old settings"
    assert client.get(f"/api/stories/{sid}/locations/flat").json() == []


# ── Diagrams, images, outlines ───────────────────────────────────────────────────


def test_diagram_create_and_delete_undo(client):
    sid = _story(client)
    d = client.post(f"/api/stories/{sid}/diagrams", json={"title": "Kin"}, headers=H).json()
    client.delete(f"/api/diagrams/{d['id']}", headers=H)
    assert _undo(client, sid) == "Delete diagram “Kin”"
    assert client.get(f"/api/diagrams/{d['id']}").json()["title"] == "Kin"
    assert _undo(client, sid) == "Add diagram “Kin”"
    assert client.get(f"/api/diagrams/{d['id']}").status_code == 404


def test_image_attach_and_detach_undo(client, db_session, test_user):
    sid = _story(client)
    c = _character(client, sid)
    asset = StoryAsset(
        story_id=sid, user_id=test_user.id, original_filename="mara.png", stored_path="x", mime_type="image/png"
    )
    db_session.add(asset)
    db_session.commit()
    body = {"object_type": "character", "object_id": c["id"], "role": "portrait"}
    att = client.post(f"/api/media/{asset.id}/attach", json=body, headers=H).json()
    listed = f"/api/media/attachments/character/{c['id']}"
    client.delete(f"/api/media/attachments/{att['id']}", headers=H)
    assert _undo(client, sid) == "Detach “mara.png”"
    assert [a["id"] for a in client.get(listed).json()] == [att["id"]]
    assert _undo(client, sid) == "Attach “mara.png”"
    assert client.get(listed).json() == []


def test_outlines_undo(client):
    sid = _story(client)
    o = client.post(f"/api/stories/{sid}/outlines", json={"name": "Plan"}, headers=H).json()
    items = [client.post(f"/api/outlines/{o['id']}/items", json={"text": t}, headers=H).json() for t in "AB"]
    ids = [i["id"] for i in items]
    client.post(f"/api/outlines/{o['id']}/reorder", json={"parent_id": None, "item_ids": ids[::-1]}, headers=H)
    assert _undo(client, sid) == "Reorder outline"
    assert [i["id"] for i in client.get(f"/api/outlines/{o['id']}").json()["items"]] == ids
    client.patch(f"/api/outlines/{o['id']}", json={"name": "Draft"}, headers=H)
    assert _undo(client, sid) == "Edit name on outline “Plan”"
    client.delete(f"/api/outlines/{o['id']}", headers=H)
    assert _undo(client, sid) == "Delete outline “Plan”"
    assert len(client.get(f"/api/outlines/{o['id']}").json()["items"]) == 2


def test_outline_from_a_beat_sheet_is_one_undo(client):
    sid = _story(client)
    sheet = client.post(
        "/api/beat-sheets", json={"name": "Three acts", "beats": [{"id": "b1", "name": "Hook", "position_pct": 0}]}
    ).json()
    o = client.post(f"/api/stories/{sid}/outlines/inject", json={"beat_sheet_id": sheet["id"]}, headers=H).json()
    assert _undo(client, sid) == "Add outline “Three acts”"
    assert client.get(f"/api/outlines/{o['id']}").status_code == 404
    _redo(client, sid)
    assert [i["text"] for i in client.get(f"/api/outlines/{o['id']}").json()["items"]] == ["Hook"]


# ── Prose rewrites: entity links, speaker tags ───────────────────────────────────


def test_applied_links_undo(client):
    sid = _story(client)
    _character(client, sid)
    n = _scene(client, sid, "<p>Mara lit the lamp.</p>")
    body = {"links": [{"matched_text": "Mara", "entity_name": "Mara", "entity_type": "character"}]}
    client.post(f"/api/structure/{n['id']}/apply-links", json=body, headers=H)
    assert _content(client, n["id"]) != "<p>Mara lit the lamp.</p>"
    assert _undo(client, sid) == "Link names in “Lamp”"
    assert _content(client, n["id"]) == "<p>Mara lit the lamp.</p>"


def test_speaker_tags_undo_in_one_scene_or_many(client):
    sid = _story(client)
    _character(client, sid)
    prose = "<p>“Go home,” she said.</p>"
    a, b = _scene(client, sid, prose, "A"), _scene(client, sid, prose, "B")
    tags = [{"quote_content": "Go home,", "speaker_name": "Mara"}]
    client.post(f"/api/scenes/{a['id']}/dialogue/apply-tags", json={"tags": tags}, headers=H)
    assert _content(client, a["id"]) != prose
    assert _undo(client, sid) == "Tag speakers in “A”"
    assert _content(client, a["id"]) == prose
    body = {"scenes": [{"scene_id": s["id"], "tags": tags} for s in (a, b)]}
    assert (
        client.post(f"/api/stories/{sid}/dialogue/apply-tags-batch", json=body, headers=H).json()["updated_count"] == 2
    )
    assert _undo(client, sid) == "Tag speakers"
    assert [_content(client, s["id"]) for s in (a, b)] == [prose, prose]


def test_a_corrected_speaker_undoes(client):
    sid = _story(client)
    _character(client, sid, "Mara")
    tom = _character(client, sid, "Tom")
    n = _scene(client, sid, "<p>“Go home,” said Mara.</p>")
    block = client.get(f"/api/scenes/{n['id']}/dialogue").json()[0]
    assert block["speaker_name"] == "Mara"
    body = {"speaker_name": "Tom", "character_id": tom["id"]}
    client.patch(f"/api/dialogue/{block['id']}", json=body, headers=H)
    assert _undo(client, sid) == "Edit speaker of a line in “Lamp”"
    again = client.get(f"/api/scenes/{n['id']}/dialogue").json()[0]
    assert (again["speaker_name"], again["attribution_method"]) == ("Mara", block["attribution_method"])


# ── The editorial pass's margin notes ────────────────────────────────────────────


def test_editorial_notes_and_reports_undo(client, db_session, test_user):
    sid = _story(client)
    report = ActivityLog(
        user_id=test_user.id, story_id=sid, event_type="editorial_pass", category="ai", description="Pass"
    )
    db_session.add(report)
    db_session.flush()
    db_session.add(Note(story_id=sid, content="Slow here", source=f"editorial-{report.id}"))
    db_session.commit()

    def notes():
        return db_session.query(Note).filter(Note.story_id == sid).count()

    client.delete(f"/api/stories/{sid}/editorial/notes", headers=H)
    assert notes() == 0
    assert _undo(client, sid) == "Clear the editor's margin notes"
    assert notes() == 1
    client.delete(f"/api/stories/{sid}/editorial/reports/{report.id}", headers=H)
    assert notes() == 0 and db_session.get(ActivityLog, report.id) is None
    assert _undo(client, sid) == "Delete editorial report"
    assert notes() == 1 and db_session.get(ActivityLog, report.id) is not None
