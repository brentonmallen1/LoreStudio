"""Scene cast (doc 11 phase 1): who, where and which threads, for every scene in one read."""

from app.models.structure import StructureNode
from tests.fixtures.story_factory import build_full_story


def test_scene_cast_lists_every_leaf_scene_with_its_signals(client, db_session, test_user):
    story = build_full_story(db_session, test_user)
    r = client.get(f"/api/stories/{story.id}/scene-cast")
    assert r.status_code == 200, r.text
    scenes = {s["node_id"]: s for s in r.json()["scenes"]}
    nodes = {n.title: n for n in db_session.query(StructureNode).filter(StructureNode.story_id == story.id)}
    # Chapters are containers, not places a character can be.
    assert set(scenes) == {nodes["Lamp"].id, nodes["Storm"].id}

    lamp = scenes[nodes["Lamp"].id]
    hero = next(c for c in story.characters if c.name == "Mara")
    assert lamp["character_ids"][0] == hero.id  # POV first, and named in the prose
    assert lamp["thread_ids"] == [story.plot_threads[0].id]
    assert lamp["location_ids"] == [next(loc.id for loc in story.locations if loc.name == "Harbour")]
    assert lamp["opening"] == '"We should go," said Mara.'
    assert lamp["status"] == "draft"

    storm = scenes[nodes["Storm"].id]
    assert storm["character_ids"] == [hero.id]  # the story's POV is there even unnamed
    assert storm["thread_ids"] == [] and storm["location_ids"] == []


def test_scene_cast_honours_the_authors_absent_answer(client, db_session, test_user):
    from app.models.location import ScenePresence

    story = build_full_story(db_session, test_user)
    lamp = next(n for n in story.structure_nodes if n.title == "Lamp")
    hero = next(c for c in story.characters if c.name == "Mara")
    row = db_session.query(ScenePresence).filter_by(node_id=lamp.id, character_id=hero.id).one()
    row.role = "absent"
    db_session.commit()
    scenes = {s["node_id"]: s for s in client.get(f"/api/stories/{story.id}/scene-cast").json()["scenes"]}
    assert hero.id not in scenes[lamp.id]["character_ids"]


def test_scene_cast_is_private_to_the_owner(client, db_session, test_user):
    from app.models.user import User

    other = User(username="someone-else", display_name="Someone", password_hash="x")
    db_session.add(other)
    db_session.commit()
    story = build_full_story(db_session, other)
    assert client.get(f"/api/stories/{story.id}/scene-cast").status_code == 404
