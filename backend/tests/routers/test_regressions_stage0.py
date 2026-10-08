"""Regression tests for the Stage 0 defects (notes/refactor-2026-09/01-audit-findings.md, B1-B12).

Each test failed against commit 115d4a7 and passes after the fix. They stay as
guards: every route here crashed or lost data on first use.
"""

from sqlalchemy import text

from app.database import Base
from app.models import ActivityLog, Story
from tests.fixtures.story_factory import build_full_story, story_owned_tables


def _make_story(client, title="T") -> str:
    return client.post("/api/stories", json={"title": title}).json()["id"]


def _make_scene(client, sid, **extra) -> dict:
    body = {"title": "S1", "content": "<p>Hello world.</p>", "level": 0, "level_type": "scene", **extra}
    r = client.post(f"/api/stories/{sid}/structure", json=body)
    assert r.status_code in (200, 201), r.text
    return r.json()


# B1 ------------------------------------------------------------------------
def test_create_character_via_story_route(client):
    sid = _make_story(client)
    r = client.post(f"/api/stories/{sid}/characters", json={"name": "Zed", "role": "protagonist"})
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Zed"


# B2 ------------------------------------------------------------------------
def test_reorder_goals_route_reachable(client):
    sid = _make_story(client)
    g1 = client.post(f"/api/stories/{sid}/goals", json={"text": "one"}).json()["goals"][-1]["id"]
    g2 = client.post(f"/api/stories/{sid}/goals", json={"text": "two"}).json()["goals"][-1]["id"]
    r = client.patch(f"/api/stories/{sid}/goals/reorder", json=[g2, g1])
    assert r.status_code == 200, r.text
    assert [g["id"] for g in r.json()["goals"]] == [g2, g1]
    # the per-goal route still works
    r = client.patch(f"/api/stories/{sid}/goals/{g1}", json={"completed": True})
    assert r.status_code == 200
    assert next(g for g in r.json()["goals"] if g["id"] == g1)["completed"] is True


# B3 ------------------------------------------------------------------------
def test_twist_impact_orders_by_position(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"affected_threads": [], "summary": "ok"})
    sid = _make_story(client)
    # Made out of reading order: the prompt must follow position, not creation
    _make_scene(client, sid, title="Later scene", position=1)
    _make_scene(client, sid, title="Earlier scene", position=0)
    tid = client.post(f"/api/stories/{sid}/twists", json={"name": "Tw"}).json()["id"]
    r = client.post(f"/api/twists/{tid}/analyze-impact")
    assert r.status_code == 200, r.text
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert prompt.index("Earlier scene") < prompt.index("Later scene")


# B4 ------------------------------------------------------------------------
def test_reader_knowledge_scan_orders_by_position(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"events": []})
    sid = _make_story(client)
    _make_scene(client, sid, title="Later scene", position=1, synopsis="A storm.")
    _make_scene(client, sid, title="Earlier scene", position=0, synopsis="A calm.")
    r = client.post(f"/api/stories/{sid}/reader-knowledge/scan")
    assert r.status_code == 200, r.text
    prompt = gw.structured_calls[0]["feature_prompt"]
    assert prompt.index("Earlier scene") < prompt.index("Later scene")


# B5 ------------------------------------------------------------------------
def test_editorial_run_on_summaries_context_does_not_crash(client, mock_ai_gateway):
    mock_ai_gateway(structured_data={"findings": [], "summary": "ok"})
    sid = _make_story(client)
    _make_scene(client, sid, content_summary="A summary.")
    r = client.post(
        f"/api/stories/{sid}/editorial/run",
        json={"scope_type": "story", "scope_ids": [], "context_level": "summaries"},
    )
    assert r.status_code == 200, r.text


# B6 ------------------------------------------------------------------------
def test_first_pass_reads_story_goals(client, mock_ai_gateway):
    gw = mock_ai_gateway(structured_data={"summary": "ok", "strengths": [], "concerns": [], "questions": []})
    sid = _make_story(client)
    client.post(f"/api/stories/{sid}/goals", json={"text": "Make the reader cry"})
    _make_scene(client, sid)
    r = client.post(f"/api/stories/{sid}/analyze/first-pass")
    assert r.status_code == 200, r.text
    # the goal text reached the prompt
    sent = " ".join(str(c) for c in gw.structured_calls)
    assert "Make the reader cry" in sent


# B7 ------------------------------------------------------------------------
def test_txt_export_title_page(client):
    sid = _make_story(client, title="Lamp")
    _make_scene(client, sid)
    r = client.post(f"/api/stories/{sid}/export", json={"format": "txt", "title_page": True})
    assert r.status_code == 200, r.text
    assert b"LAMP" in r.content


# B10 -----------------------------------------------------------------------
def test_update_node_merges_metadata(client):
    sid = _make_story(client)
    nid = _make_scene(client, sid)["id"]
    client.patch(f"/api/structure/{nid}", json={"metadata_": {"mice_opens": "q"}})
    client.patch(f"/api/structure/{nid}", json={"metadata_": {"pov_note": "x"}})
    meta = client.get(f"/api/structure/{nid}").json()["metadata_"]
    assert meta == {"mice_opens": "q", "pov_note": "x"}


# B11 -----------------------------------------------------------------------
def test_foreign_keys_enabled(db_session):
    assert db_session.execute(text("PRAGMA foreign_keys")).scalar() == 1


# B12 -----------------------------------------------------------------------
def test_delete_story_leaves_no_orphans(client, db_session, test_user):
    story = build_full_story(db_session, test_user)
    sid = story.id
    tables = story_owned_tables(Base.metadata)
    # sanity: the factory populated every story-owned table
    for t in tables:
        if t == "activity_logs":
            continue
        n = db_session.execute(text(f"SELECT count(*) FROM {t} WHERE story_id = :sid"), {"sid": sid}).scalar()
        assert n > 0, f"factory left {t} empty; update tests/fixtures/story_factory.py"

    r = client.delete(f"/api/stories/{sid}")
    assert r.status_code == 204, r.text
    db_session.expire_all()

    orphans = {}
    for t in tables:
        n = db_session.execute(text(f"SELECT count(*) FROM {t} WHERE story_id = :sid"), {"sid": sid}).scalar()
        if n:
            orphans[t] = n
    assert orphans == {}, f"orphan rows after story delete: {orphans}"
    # activity logs are kept (audit trail) but detached from the story
    assert db_session.query(ActivityLog).filter(ActivityLog.story_id == sid).count() == 0
    assert db_session.query(Story).filter(Story.id == sid).count() == 0
    # indirect children are gone too
    for t in (
        "character_relationships",
        "dialogue_blocks",
        "scene_settings",
        "location_travel",
        "outline_items",
        "asset_attachments",
        "compendium_attachments",
        "chat_messages",
        "character_journey_summaries",
        "plot_thread_appearances",
        "character_interviews",
    ):
        assert db_session.execute(text(f"SELECT count(*) FROM {t}")).scalar() == 0, t


def test_delete_single_entities_with_foreign_keys_on(client, db_session, test_user):
    """Each entity delete route must succeed now that SQLite enforces FKs."""
    story = build_full_story(db_session, test_user)
    sid = story.id
    scene = next(n for n in story.structure_nodes if n.title == "Lamp")
    hero = next(c for c in story.characters if c.name == "Mara")
    harbour = next(loc for loc in story.locations if loc.name == "Harbour")
    twist = story.twists[0]
    asset = story.assets[0]

    for url in (
        f"/api/structure/{scene.id}",
        f"/api/characters/{hero.id}",
        f"/api/locations/{harbour.id}",
        f"/api/twists/{twist.id}",
        f"/api/media/{asset.id}",
    ):
        r = client.delete(url)
        assert r.status_code in (200, 204), f"{url}: {r.status_code} {r.text}"
    db_session.expire_all()
    assert client.get(f"/api/stories/{sid}").status_code == 200


# purpose column (Stage 1); margin notes are note rows since doc 15 ---------------
def test_purpose_is_a_column_and_legacy_metadata_is_hoisted(client):
    sid = _make_story(client)
    nid = _make_scene(client, sid)["id"]
    r = client.patch(f"/api/structure/{nid}", json={"purpose": "tension"})
    assert r.status_code == 200, r.text
    assert r.json()["purpose"] == "tension"
    # an older client sending them inside metadata_ lands in the column, not the JSON;
    # its inline_notes are dropped (a margin note is a row in notes now)
    notes = [{"id": "n1", "anchor": "Hello", "note": "keep me", "position": 0}]
    r = client.patch(
        f"/api/structure/{nid}",
        json={"metadata_": {"purpose": "release", "inline_notes": notes, "mice_opens": "x"}},
    )
    body = r.json()
    assert body["purpose"] == "release"
    assert "inline_notes" not in body
    assert body["metadata_"] == {"mice_opens": "x"}


# optimistic concurrency on scene updates (Stage 1) --------------------------
def test_update_node_conflict_detection(client):
    sid = _make_story(client)
    node = _make_scene(client, sid)
    seen = node["updated_at"]
    ok = client.patch(f"/api/structure/{node['id']}", json={"content": "<p>v2</p>", "expected_updated_at": seen})
    assert ok.status_code == 200, ok.text
    # a second client still holding the old timestamp is refused and told the current state
    stale = client.patch(
        f"/api/structure/{node['id']}", json={"content": "<p>v3</p>", "expected_updated_at": "2000-01-01T00:00:00"}
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["detail"]["node"]["content"] == "<p>v2</p>"
    # without the field the write is unconditional (undo, restore, older clients)
    force = client.patch(f"/api/structure/{node['id']}", json={"content": "<p>v3</p>"})
    assert force.status_code == 200
