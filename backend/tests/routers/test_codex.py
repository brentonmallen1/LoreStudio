"""The Codex API: read the graph, correct who is in a scene, queue a rebuild (doc 07)."""

from app.models.activity_log import ActivityLog
from app.models.ai_job import AIJob
from app.models.character import Character
from app.models.codex import CodexChunk, CodexNode
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.embeddings import DEFAULT_EMBED_MODEL, pack
from app.services.codex.index import build_chunks, pending_chunks
from app.services.codex.sync import sync_story


def _setup(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    elena = Character(story_id=story.id, name="Elena")
    db.add(elena)
    db.flush()
    scene = StructureNode(
        story_id=story.id,
        title="The Mainland",
        level=0,
        level_type="scene",
        position=0,
        content="<p>They spoke of Elena.</p>",
    )
    db.add(scene)
    db.commit()
    return story, elena, scene


def test_the_graph_reads_back_with_its_counts(client, db_session, test_user):
    story, _, _ = _setup(db_session, test_user)
    sync_story(story.id, db_session)

    body = client.get(f"/api/stories/{story.id}/codex").json()
    assert body["counts"]["character"] == 1
    assert body["counts"]["scene"] == 1
    assert {n["kind"] for n in body["nodes"]} == {"character", "scene"}


def test_who_is_here_shows_the_reason_and_takes_a_correction(client, db_session, test_user):
    story, elena, scene = _setup(db_session, test_user)
    sync_story(story.id, db_session)

    before = client.get(f"/api/stories/{story.id}/codex/presence/{scene.id}").json()
    assert before["synced"] is True
    assert before["characters"][0] == {
        "character_id": elena.id,
        "name": "Elena",
        "role": "mentioned",
        "basis": "mention",
        "overridden": False,
    }

    r = client.post(
        f"/api/stories/{story.id}/codex/presence",
        json={"character_id": elena.id, "node_id": scene.id, "role": "absent"},
    )
    assert r.status_code == 200 and r.json()["role"] == "absent"

    after = client.get(f"/api/stories/{story.id}/codex/presence/{scene.id}").json()
    assert after["characters"][0]["role"] == "absent"
    assert after["characters"][0]["basis"] == "manual"


def test_an_unsynced_story_says_so_rather_than_pretending(client, db_session, test_user):
    story, _, scene = _setup(db_session, test_user)
    body = client.get(f"/api/stories/{story.id}/codex/presence/{scene.id}").json()
    assert body == {"synced": False, "characters": []}


def test_a_role_the_graph_does_not_use_is_refused(client, db_session, test_user):
    story, elena, scene = _setup(db_session, test_user)
    sync_story(story.id, db_session)
    r = client.post(
        f"/api/stories/{story.id}/codex/presence",
        json={"character_id": elena.id, "node_id": scene.id, "role": "lurking"},
    )
    assert r.status_code == 422


def test_a_rebuild_is_queued_not_run_in_the_request(client, db_session, test_user):
    story, _, _ = _setup(db_session, test_user)
    r = client.post(f"/api/stories/{story.id}/codex/sync")
    assert r.status_code == 202 and r.json()["job_id"]


def test_another_authors_story_is_not_readable(client, db_session, test_user):
    from app.auth.utils import hash_password
    from app.models.user import User

    stranger = User(id="stranger", username="stranger", password_hash=hash_password("x"), display_name="S", settings={})
    db_session.add(stranger)
    db_session.flush()
    theirs = Story(title="Theirs", user_id=stranger.id)
    db_session.add(theirs)
    db_session.commit()

    assert client.get(f"/api/stories/{theirs.id}/codex").status_code == 404
    assert client.post(f"/api/stories/{theirs.id}/codex/sync").status_code == 404


def test_the_index_reports_what_it_holds_and_how_search_will_run(client, db_session, test_user):
    story, _, scene = _setup(db_session, test_user)
    scene.content = f"<p>{' '.join(['lamp'] * 120)}</p>"
    db_session.commit()
    sync_story(story.id, db_session)
    build_chunks(story.id, db_session)

    body = client.get(f"/api/stories/{story.id}/codex/index").json()
    assert body["chunks"] == 1
    assert body["embedded"] == 0 and body["pending"] == 1
    assert body["backend"] in ("sqlite-vec", "python")
    assert body["effective_embed_model"] == DEFAULT_EMBED_MODEL


def test_queueing_a_reindex_makes_a_job(client, db_session, test_user):
    story, _, _ = _setup(db_session, test_user)
    body = client.post(f"/api/stories/{story.id}/codex/index")
    assert body.status_code == 202
    job = db_session.query(AIJob).filter(AIJob.id == body.json()["job_id"]).one()
    assert job.kind == "codex-index"
    assert job.params["embed_model"] == DEFAULT_EMBED_MODEL


def test_choosing_an_embedding_model_does_not_throw_away_the_old_vectors(client, db_session, test_user):
    """
    Vectors record the model that made them, so the old ones simply stop matching.

    Re-embedding is minutes of the author's machine; making that happen the instant a
    dropdown changes would be deciding for them.
    """
    story, _, scene = _setup(db_session, test_user)
    scene.content = f"<p>{' '.join(['lamp'] * 120)}</p>"
    db_session.commit()
    sync_story(story.id, db_session)
    build_chunks(story.id, db_session)
    chunk = db_session.query(CodexChunk).one()
    chunk.embedding, chunk.embed_model, chunk.dim = pack([1.0, 0.0]), "nomic-embed-text", 2
    db_session.commit()

    assert client.get("/api/codex/settings").json()["effective_embed_model"] == DEFAULT_EMBED_MODEL
    body = client.patch("/api/codex/settings", json={"embed_model": "mxbai-embed-large"}).json()
    assert body["effective_embed_model"] == "mxbai-embed-large"

    db_session.refresh(chunk)
    assert chunk.embedding is not None
    assert len(pending_chunks(story.id, db_session, "mxbai-embed-large")) == 1


def test_clearing_the_model_falls_back_to_the_default(client, db_session, test_user):
    client.patch("/api/codex/settings", json={"embed_model": "mxbai-embed-large"})
    body = client.patch("/api/codex/settings", json={"embed_model": None}).json()
    assert body["embed_model"] is None
    assert body["effective_embed_model"] == DEFAULT_EMBED_MODEL


def test_a_node_page_shows_what_it_connects_to_and_how_used_it_is(client, db_session, test_user):
    story, elena, scene = _setup(db_session, test_user)
    scene.pov_character_id = elena.id
    scene.content = f"<p>{' '.join(['lamp'] * 120)}</p>"
    db_session.commit()
    sync_story(story.id, db_session)
    build_chunks(story.id, db_session)
    db_session.add(
        ActivityLog(
            user_id=test_user.id,
            story_id=story.id,
            event_type="ai_call",
            category="ai",
            description="Scene assistant",
            metadata_={"node_id": scene.id},
        )
    )
    db_session.commit()

    node = db_session.query(CodexNode).filter(CodexNode.ref_id == scene.id).one()
    body = client.get(f"/api/stories/{story.id}/codex/nodes/{node.id}").json()
    assert body["node"]["label"] == "The Mainland"
    assert body["chunks"] == 1 and body["embedded"] == 0
    assert body["ai_calls"] == 1
    # The point-of-view edge runs scene -> character, so it reads as outgoing here.
    pov = [e for e in body["edges"] if e["kind"] == "pov"]
    assert len(pov) == 1
    assert (pov[0]["direction"], pov[0]["other_label"]) == ("out", "Elena")


def test_a_node_from_another_story_is_not_found(client, db_session, test_user):
    story, _, _ = _setup(db_session, test_user)
    assert client.get(f"/api/stories/{story.id}/codex/nodes/nope").status_code == 404
