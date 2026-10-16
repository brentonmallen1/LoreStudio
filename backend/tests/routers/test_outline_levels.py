"""
The Outline moves a row a level (doc 29 D2): Shift+Tab makes a planned scene the chapter that
holds the scenes after it, Tab tucks it back. One reorder carries the row's new parent, place
and level name, and one undo puts all of it back.
"""

import pytest

from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.seed import STRUCTURE_TEMPLATES


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _scene(client, sid, parent, title, position):
    return client.post(
        f"/api/stories/{sid}/structure",
        json={
            "parent_id": parent,
            "level": 1,
            "level_type": "scene",
            "title": title,
            "position": position,
            "status": "planned",
        },
    ).json()["id"]


def test_a_scene_moved_out_a_level_becomes_a_chapter_and_undo_puts_it_back(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "freeform"}).json()
    sid = story["id"]
    section = db_session.get(StructureNode, story["start_node_id"]).parent_id
    first = story["start_node_id"]
    storm = _scene(client, sid, section, "The storm", 1)
    knock = _scene(client, sid, section, "A knock", 2)

    # Shift+Tab on "The storm": it becomes a section after the first, holding "A knock".
    r = client.post(
        f"/api/stories/{sid}/structure/reorder",
        json={
            "operations": [
                {"node_id": storm, "parent_id": None, "position": 1, "level_type": "section"},
                {"node_id": knock, "parent_id": storm, "position": 0},
            ]
        },
    )
    assert r.status_code == 204, r.text
    db_session.expire_all()
    moved, under = db_session.get(StructureNode, storm), db_session.get(StructureNode, knock)
    assert (moved.parent_id, moved.level, moved.level_type) == (None, 0, "section")
    assert (under.parent_id, under.level, under.level_type) == (storm, 1, "scene")
    assert db_session.get(StructureNode, first).parent_id == section

    assert client.post(f"/api/stories/{sid}/undo").status_code == 200
    db_session.expire_all()
    back = db_session.get(StructureNode, storm)
    assert (back.parent_id, back.level, back.level_type, back.position) == (section, 1, "scene", 1)
    assert db_session.get(StructureNode, knock).parent_id == section

    assert client.post(f"/api/stories/{sid}/redo").status_code == 200
    db_session.expire_all()
    assert db_session.get(StructureNode, storm).level_type == "section"


def test_a_reorder_without_a_level_name_keeps_the_rows_own(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "freeform"}).json()
    sid = story["id"]
    section = db_session.get(StructureNode, story["start_node_id"]).parent_id
    storm = _scene(client, sid, section, "The storm", 1)
    r = client.post(
        f"/api/stories/{sid}/structure/reorder",
        json={"operations": [{"node_id": storm, "parent_id": section, "position": 0}]},
    )
    assert r.status_code == 204
    db_session.expire_all()
    assert db_session.get(StructureNode, storm).level_type == "scene"


def test_a_line_added_in_the_middle_makes_room_for_itself(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "freeform"}).json()
    sid = story["id"]
    section = db_session.get(StructureNode, story["start_node_id"]).parent_id
    _scene(client, sid, section, "The storm", 1)
    r = client.post(
        f"/api/stories/{sid}/structure",
        json={
            "parent_id": section,
            "level": 1,
            "level_type": "scene",
            "title": "Between",
            "position": 1,
            "status": "planned",
            "insert": True,
        },
    )
    assert r.status_code == 201
    db_session.expire_all()
    kids = (
        db_session.query(StructureNode)
        .filter(StructureNode.parent_id == section)
        .order_by(StructureNode.position)
        .all()
    )
    assert [k.title for k in kids] == ["Scene 1", "Between", "The storm"]
