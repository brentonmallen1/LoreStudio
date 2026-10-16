"""Organizing prose (doc 29 D6): split a scene at the cursor, join a scene with the next one, and
wrap scenes in a chapter, each one change ⌘Z takes back whole."""

import pytest

from app.models import Character, Note, Story
from app.models.dialogue import DialogueBlock
from app.models.location import ScenePresence
from app.models.scene_link import SceneLink
from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.dialogue_service import sync_scene_dialogue
from app.services.seed import STRUCTURE_TEMPLATES
from tests.fixtures.findings_story import build_findings_story


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _undo(client, story):
    r = client.post(f"/api/stories/{story.id}/undo")
    assert r.status_code == 200, r.text


def _tree(db_session, story):
    db_session.expire_all()
    nodes = db_session.query(StructureNode).filter_by(story_id=story.id).all()
    kids: dict = {}
    for n in nodes:
        kids.setdefault(n.parent_id, []).append(n)

    def walk(pid):
        return [(n.title, walk(n.id)) for n in sorted(kids.get(pid, []), key=lambda n: n.position)]

    return walk(None)


# ── Split ──


def test_a_prose_scene_splits_at_the_cursor_under_the_title_asked_for(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    storm = nodes["The Storm"]
    before, after = "<p>The rail was cold.</p>", "<p>By morning the sea was flat.</p>"
    storm.content = before + after
    db_session.commit()
    r = client.post(
        f"/api/structure/{storm.id}/split",
        json={"content": before, "new_content": after, "title": "The Storm (continued)"},
    )
    assert r.status_code == 201, r.text
    new = r.json()
    assert (new["title"], new["parent_id"], new["status"]) == ("The Storm (continued)", storm.parent_id, "draft")
    assert new["word_count"] == 6
    assert _tree(db_session, story)[1] == (
        "Chapter 2",
        [("The Storm", []), ("The Storm (continued)", []), ("Morning", []), ("The Letter", [])],
    )
    _undo(client, story)
    assert db_session.get(StructureNode, storm.id).content == before + after
    assert db_session.get(StructureNode, new["id"]) is None


# ── Join ──


def test_joining_keeps_the_first_scene_with_both_scenes_words_and_everything_on_them(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    a, b, c = nodes["The Storm"], nodes["Morning"], nodes["The Letter"]
    a.synopsis, b.synopsis = "Eleanor holds on.", "The sky clears."
    a.entry_state, b.exit_state = "Afraid", "Calm"
    db_session.add(Note(id="n-b", story_id=story.id, kind="note", node_id=b.id, anchor="grey", content="Colour?"))
    db_session.add(SceneLink(story_id=story.id, source_node_id=a.id, target_node_id=b.id, link_type="parallel"))
    db_session.add(
        SceneLink(id="l-cb", story_id=story.id, source_node_id=c.id, target_node_id=b.id, link_type="callback")
    )
    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor Vance").one()
    b.content += "<p>“It’s over,”&lt;Eleanor Vance&gt; she said.</p>"
    db_session.commit()
    sync_scene_dialogue(b, db_session)
    line = db_session.query(DialogueBlock).filter_by(scene_id=b.id).one()
    line.subtext = "It isn't."
    db_session.add(ScenePresence(node_id=b.id, character_id=eleanor.id, role="participant"))
    db_session.commit()
    a_words, a_content, b_content = a.word_count, a.content, b.content

    r = client.post(f"/api/structure/{a.id}/merge-next", json={})
    assert r.status_code == 200, r.text
    joined = r.json()
    assert joined["content"] == a_content + "<hr>" + b_content
    assert joined["synopsis"] == "Eleanor holds on. The sky clears."
    assert (joined["entry_state"], joined["exit_state"]) == ("Afraid", "Calm")
    assert joined["word_count"] > a_words
    db_session.expire_all()
    assert db_session.get(StructureNode, b.id) is None
    assert db_session.get(Note, "n-b").node_id == a.id
    assert db_session.get(SceneLink, "l-cb").target_node_id == a.id
    assert db_session.query(SceneLink).filter_by(source_node_id=a.id, target_node_id=a.id).count() == 0
    assert db_session.query(ScenePresence).filter_by(node_id=a.id, character_id=eleanor.id).count() == 1
    moved = db_session.get(DialogueBlock, line.id)
    assert (moved.scene_id, moved.subtext, moved.paragraph_index) == (a.id, "It isn't.", 2)

    _undo(client, story)
    db_session.expire_all()
    back = db_session.get(StructureNode, b.id)
    assert back is not None and back.content == b_content and back.synopsis == "The sky clears."
    assert db_session.get(StructureNode, a.id).content == a_content
    assert db_session.get(Note, "n-b").node_id == b.id
    assert db_session.get(SceneLink, "l-cb").target_node_id == b.id
    assert db_session.query(SceneLink).filter_by(source_node_id=a.id, target_node_id=b.id).count() == 1
    assert db_session.query(ScenePresence).filter_by(node_id=b.id).count() == 1
    assert db_session.get(DialogueBlock, line.id).scene_id == b.id


def test_the_last_scene_in_a_chapter_is_not_joined_across_chapters(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    r = client.post(f"/api/structure/{nodes['Supper'].id}/merge-next", json={})
    assert r.status_code == 400
    assert "Scenes join only within one chapter" in r.json()["detail"]
    assert db_session.get(StructureNode, nodes["The Storm"].id) is not None


def test_a_scene_changed_since_it_was_loaded_is_not_joined(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    r = client.post(
        f"/api/structure/{nodes['Arrival'].id}/merge-next", json={"expected_updated_at": "2001-01-01T00:00:00"}
    )
    assert r.status_code == 409


# ── Wrap ──


def _wrap(client, story, ids, title="New"):
    return client.post(f"/api/stories/{story.id}/structure/wrap", json={"node_ids": ids, "title": title})


def test_scenes_from_the_start_of_a_chapter_get_a_chapter_before_it(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    r = _wrap(client, story, [nodes["Arrival"].id, nodes["The Lamp"].id], "Landfall")
    assert r.status_code == 200, r.text
    assert [p["title"] for p in r.json()] == ["Landfall"]
    assert r.json()[0]["level_type"] == "section"
    assert _tree(db_session, story) == [
        ("Landfall", [("Arrival", []), ("The Lamp", [])]),
        ("Chapter 1", [("Supper", [])]),
        ("Chapter 2", [("The Storm", []), ("Morning", []), ("The Letter", [])]),
        ("Chapter 3", []),
    ]
    _undo(client, story)
    assert _tree(db_session, story)[0] == ("Chapter 1", [("Arrival", []), ("The Lamp", []), ("Supper", [])])
    assert len(_tree(db_session, story)) == 3


def test_scenes_from_the_middle_leave_the_chapter_in_three_in_reading_order(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    r = _wrap(client, story, [nodes["Morning"].id], "Calm")
    assert r.status_code == 200, r.text
    assert [p["title"] for p in r.json()] == ["Calm", "Chapter 2 (continued)"]
    assert _tree(db_session, story) == [
        ("Chapter 1", [("Arrival", []), ("The Lamp", []), ("Supper", [])]),
        ("Chapter 2", [("The Storm", [])]),
        ("Calm", [("Morning", [])]),
        ("Chapter 2 (continued)", [("The Letter", [])]),
        ("Chapter 3", []),
    ]
    _undo(client, story)
    assert _tree(db_session, story)[1] == ("Chapter 2", [("The Storm", []), ("Morning", []), ("The Letter", [])])
    assert len(_tree(db_session, story)) == 3


def test_wrapping_is_refused_where_it_cannot_keep_the_order(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    apart = _wrap(client, story, [nodes["Arrival"].id, nodes["Supper"].id])
    assert apart.status_code == 400 and "next to each other" in apart.json()["detail"]
    across = _wrap(client, story, [nodes["Supper"].id, nodes["The Storm"].id])
    assert across.status_code == 400 and "one part" in across.json()["detail"]
    whole = _wrap(client, story, [nodes["Arrival"].id, nodes["The Lamp"].id, nodes["Supper"].id])
    assert whole.status_code == 400 and "every scene in “Chapter 1”" in whole.json()["detail"]
    assert _wrap(client, story, [nodes["Arrival"].id], "  ").status_code == 400


def test_a_flat_shape_has_nothing_to_wrap_scenes_in(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user, chapters=False)
    db_session.get(Story, story.id).structure_template_id = "mice-single"
    db_session.commit()
    r = _wrap(client, story, [nodes["Arrival"].id])
    assert r.status_code == 400 and "side by side" in r.json()["detail"]
