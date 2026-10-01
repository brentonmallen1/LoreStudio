"""The findings feed over HTTP (doc 12 P3): read, dismiss, the lapse on edit, fix, local run."""

from app.models.activity_log import ActivityLog
from app.models.change import Change
from app.models.finding_dismissal import FindingDismissal
from tests.fixtures.findings_story import build_findings_story


def _feed(client, story):
    r = client.get(f"/api/stories/{story.id}/findings")
    assert r.status_code == 200, r.text
    return r.json()


def _drift(feed):
    return next(f for f in feed["findings"] if f["check"] == "name_drift")


def test_the_feed_in_reading_order_with_counts(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    feed = _feed(client, story)
    checks = [f["check"] for f in feed["findings"]]
    assert checks == ["name_drift", "empty_chapter", "absent_character"]  # scene order, then the rest
    assert feed["open_count"] == 3 and feed["dismissed_count"] == 0
    assert feed["counts_by_kind"] == {"continuity": 1, "structure": 1, "cast": 1}
    assert feed["sizing"] == {"has_chapters": True, "has_target": False, "written_scenes": 6}
    assert _drift(feed)["anchor"]["node_id"] == nodes["The Lamp"].id
    assert client.get(f"/api/stories/{story.id}/findings/count").json() == {"count": 3}
    assert client.get(f"/api/stories/{story.id}/health/alerts").json()["count"] == 3


def test_dismiss_hides_until_the_scene_changes(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    fp = _drift(_feed(client, story))["id"]
    assert client.post(f"/api/stories/{story.id}/findings/{fp}/dismiss").status_code == 204
    feed = _feed(client, story)
    assert fp not in {f["id"] for f in feed["findings"]} and feed["dismissed_count"] == 1

    # D4: the author edits the scene; what was intended about the old text lapses.
    lamp = nodes["The Lamp"]
    lamp.content = lamp.content.replace("the sea", "the cold sea")
    db_session.commit()
    assert fp in {f["id"] for f in _feed(client, story)["findings"]}

    # Dismissing again renews it against the scene as it is now.
    assert client.post(f"/api/stories/{story.id}/findings/{fp}/dismiss").status_code == 204
    assert fp not in {f["id"] for f in _feed(client, story)["findings"]}
    assert db_session.query(FindingDismissal).filter_by(story_id=story.id).count() == 1


def test_an_entity_dismissal_does_not_lapse(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    fp = next(f["id"] for f in _feed(client, story)["findings"] if f["check"] == "absent_character")
    client.post(f"/api/stories/{story.id}/findings/{fp}/dismiss")
    nodes["Supper"].content += "<p>More.</p>"
    db_session.commit()
    assert fp not in {f["id"] for f in _feed(client, story)["findings"]}


def test_dismiss_can_be_undone_and_brought_back(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    fp = _drift(_feed(client, story))["id"]
    client.post(f"/api/stories/{story.id}/findings/{fp}/dismiss")
    r = client.post(f"/api/stories/{story.id}/undo")
    assert r.status_code == 200, r.text
    assert fp in {f["id"] for f in _feed(client, story)["findings"]}

    client.post(f"/api/stories/{story.id}/findings/{fp}/dismiss")
    assert client.delete(f"/api/stories/{story.id}/findings/{fp}/dismiss").status_code == 204
    assert fp in {f["id"] for f in _feed(client, story)["findings"]}


def test_unknown_fingerprint_is_a_404(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    assert client.post(f"/api/stories/{story.id}/findings/nope/dismiss").status_code == 404
    assert client.post(f"/api/stories/{story.id}/findings/nope/fix").status_code == 404


def test_fix_renames_in_that_scene_and_logs_the_change(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    fp = _drift(_feed(client, story))["id"]
    r = client.post(f"/api/stories/{story.id}/findings/{fp}/fix")
    assert r.status_code == 200, r.text
    assert r.json() == {"node_id": nodes["The Lamp"].id, "replaced": 1}
    db_session.refresh(nodes["The Lamp"])
    assert "Eleanor lit the lamp" in nodes["The Lamp"].content
    change = db_session.query(Change).filter_by(story_id=story.id, entity_id=nodes["The Lamp"].id).one()
    assert change.label == "Fix “Elenor” → “Eleanor” in The Lamp" and change.undoable is False
    assert "name_drift" not in {f["check"] for f in _feed(client, story)["findings"]}


def test_a_finding_without_a_fix_refuses(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    fp = next(f["id"] for f in _feed(client, story)["findings"] if f["check"] == "absent_character")
    assert client.post(f"/api/stories/{story.id}/findings/{fp}/fix").status_code == 422


def test_run_local_logs_both_spacy_passes(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/findings/run-local")
    assert r.status_code == 200, r.text
    assert r.json()["last_local_run"] is not None
    features = {
        log.metadata_["feature"]
        for log in db_session.query(ActivityLog).filter_by(story_id=story.id, event_type="analysis_run")
    }
    assert features == {"prose-analysis", "editorial-consistency"}


def test_the_feed_is_private_to_the_owner(client, db_session, test_user):
    from app.models.user import User

    other = User(username="someone-else", display_name="Someone", password_hash="x")
    db_session.add(other)
    db_session.commit()
    story, _ = build_findings_story(db_session, other)
    assert client.get(f"/api/stories/{story.id}/findings").status_code == 404
