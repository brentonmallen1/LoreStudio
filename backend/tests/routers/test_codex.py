"""The Codex API: read the graph, correct who is in a scene, queue a rebuild (doc 07)."""

from app.models.character import Character
from app.models.story import Story
from app.models.structure import StructureNode
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
