"""The call-detail endpoint: what the transparency view reads (doc 06 §3, §9)."""

from app.models.activity_log import ActivityLog
from app.models.ai_call import AICallPayload


def _call(db, user, **meta):
    log = ActivityLog(
        user_id=user.id,
        event_type="ai_interview",
        category="ai",
        description="Tell me about the lighthouse",
        metadata_={"feature": "interview", "model": "gemma4", "status": "ok", "tokens_in": 900, **meta},
    )
    db.add(log)
    db.flush()
    db.add(
        AICallPayload(
            activity_log_id=log.id,
            system_prompt="You are Elena.",
            messages=[{"role": "user", "content": "Tell me about the lighthouse"}],
            raw_response="It has stood there since before I was born.",
            options={"num_ctx": 16384, "temperature": 0.8},
        )
    )
    db.commit()
    return log


def test_call_detail_returns_the_prompt_that_was_actually_sent(client, db_session, test_user):
    log = _call(db_session, test_user)
    r = client.get(f"/api/ai/calls/{log.id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["feature_label"] == "Character Interview"
    assert body["classification"] == "persona"
    assert body["payload"]["system_prompt"] == "You are Elena."
    assert body["payload"]["options"]["num_ctx"] == 16384


def test_a_pruned_payload_leaves_the_summary_readable(client, db_session, test_user):
    log = _call(db_session, test_user)
    db_session.query(AICallPayload).delete()
    db_session.commit()
    body = client.get(f"/api/ai/calls/{log.id}").json()
    assert body["payload"] is None
    assert body["status"] == "ok"
    assert body["tokens_in"] == 900


def test_calls_recorded_before_statuses_existed_read_as_ok(client, db_session, test_user):
    log = ActivityLog(
        user_id=test_user.id,
        event_type="ai_interview",
        category="ai",
        description="old",
        metadata_={"feature": "interview"},
    )
    db_session.add(log)
    db_session.commit()
    assert client.get(f"/api/ai/calls/{log.id}").json()["status"] == "ok"


def test_non_ai_and_unknown_ids_are_not_found(client, db_session, test_user):
    log = ActivityLog(user_id=test_user.id, event_type="export", category="system", description="x", metadata_={})
    db_session.add(log)
    db_session.commit()
    assert client.get(f"/api/ai/calls/{log.id}").status_code == 404
    assert client.get("/api/ai/calls/nope").status_code == 404


def test_purge_drops_the_prose_and_keeps_the_record(client, db_session, test_user):
    log = _call(db_session, test_user)
    r = client.delete("/api/ai/payloads")
    assert r.status_code == 200 and r.json()["removed"] == 1
    assert client.get(f"/api/ai/calls/{log.id}").json()["payload"] is None


def test_latest_finds_the_call_behind_a_result(client, db_session, test_user):
    """ "Show me what was sent" must show what was sent, not a preview built afterwards."""
    older = _call(db_session, test_user)
    newer = _call(db_session, test_user)
    assert older.id != newer.id

    body = client.get("/api/ai/calls/latest?feature=interview").json()
    assert body["id"] == newer.id
    assert body["payload"]["system_prompt"] == "You are Elena."


def test_latest_narrows_by_context(client, db_session, test_user):
    _call(db_session, test_user, node_id="scene-1")
    wanted = _call(db_session, test_user, node_id="scene-2")
    body = client.get("/api/ai/calls/latest?feature=interview&node_id=scene-2").json()
    assert body["id"] == wanted.id


def test_latest_is_null_when_the_feature_has_not_run_here(client, db_session, test_user):
    _call(db_session, test_user)
    assert client.get("/api/ai/calls/latest?feature=whatif").json() is None


def test_activity_can_be_filtered_to_the_calls_that_went_wrong(client, db_session, test_user):
    _call(db_session, test_user)
    _call(db_session, test_user, status="error", error="no route to host")
    _call(db_session, test_user, status="cancelled")

    all_rows = client.get("/api/chronicle/activity").json()
    assert all_rows["total"] == 3
    problems = client.get("/api/chronicle/activity?problems=true").json()
    assert {row["metadata_"]["status"] for row in problems["logs"]} == {"error", "cancelled"}


def test_activity_can_be_filtered_by_feature(client, db_session, test_user):
    """The feature filter used PostgreSQL-only syntax and would have raised on SQLite."""
    _call(db_session, test_user)
    _call(db_session, test_user, feature="whatif")

    rows = client.get("/api/chronicle/activity?features=whatif").json()
    assert rows["total"] == 1
    assert rows["logs"][0]["metadata_"]["feature"] == "whatif"
