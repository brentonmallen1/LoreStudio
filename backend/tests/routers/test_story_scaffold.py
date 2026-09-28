"""
A new story starts with its structure's first outline (services/structure_scaffold.py).

Choosing "Three-Act Structure" used to create nothing, and the author took twelve steps
to reach a scene they could type in.
"""

import pytest

from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.seed import STRUCTURE_TEMPLATES


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _tree(db_session, story_id):
    nodes = db_session.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    return {n.id: n for n in nodes}


def test_three_act_lays_out_its_acts_and_a_first_scene(client, db_session):
    body = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    nodes = _tree(db_session, body["id"])
    tops = sorted((n for n in nodes.values() if n.parent_id is None), key=lambda n: n.position)
    assert [n.title for n in tops] == ["Act 1: Setup", "Act 2: Confrontation", "Act 3: Resolution"]

    start = nodes[body["start_node_id"]]
    assert (start.level, start.level_type, start.title) == (2, "scene", "Scene 1")
    chapter = nodes[start.parent_id]
    assert (chapter.level_type, chapter.parent_id) == ("chapter", tops[0].id)


def test_a_flat_template_puts_its_beats_side_by_side(client, db_session):
    body = client.post("/api/stories", json={"title": "Flash", "structure_template_id": "mice-single"}).json()
    nodes = _tree(db_session, body["id"])
    assert {n.level for n in nodes.values()} == {0}
    assert [n.title for n in sorted(nodes.values(), key=lambda n: n.position)] == [
        "Opening",
        "Try / Fail",
        "Resolution",
    ]
    assert nodes[body["start_node_id"]].title == "Opening"


def test_a_template_without_names_starts_numbered(client, db_session):
    body = client.post("/api/stories", json={"title": "Loose", "structure_template_id": "freeform"}).json()
    nodes = _tree(db_session, body["id"])
    assert sorted(n.title for n in nodes.values()) == ["Scene 1", "Section 1"]
    assert nodes[body["start_node_id"]].title == "Scene 1"


def test_the_author_can_start_empty(client, db_session):
    body = client.post(
        "/api/stories", json={"title": "Blank", "structure_template_id": "three-act", "scaffold": False}
    ).json()
    assert body["start_node_id"] is None
    assert _tree(db_session, body["id"]) == {}


def test_templates_say_what_a_new_story_starts_with(client):
    by_id = {t["id"]: t for t in client.get("/api/templates/structures").json()}
    assert by_id["three-act"]["starter_outline"] == ["Act 1: Setup", "Act 2: Confrontation", "Act 3: Resolution"]
    assert by_id["freeform"]["starter_outline"] == ["Section 1"]


def test_an_empty_story_starts_its_outline_in_one_call(client, db_session):
    story = client.post(
        "/api/stories", json={"title": "Later", "structure_template_id": "three-act", "scaffold": False}
    ).json()
    started = client.post(f"/api/stories/{story['id']}/structure/start")
    assert started.status_code == 200, started.text
    nodes = _tree(db_session, story["id"])
    assert nodes[started.json()["start_node_id"]].title == "Scene 1"
    # Only an empty story: a second call would pile a new outline on top of the first.
    assert client.post(f"/api/stories/{story['id']}/structure/start").status_code == 409


def test_one_undo_removes_the_whole_starting_outline(client, db_session):
    story = client.post(
        "/api/stories", json={"title": "Undo", "structure_template_id": "three-act", "scaffold": False}
    ).json()
    headers = {"X-Client-Id": "tab-1"}
    client.post(f"/api/stories/{story['id']}/structure/start", headers=headers)
    assert len(_tree(db_session, story["id"])) == 5
    undone = client.post(f"/api/stories/{story['id']}/undo", headers=headers)
    assert undone.status_code == 200, undone.text
    db_session.expire_all()
    assert _tree(db_session, story["id"]) == {}


def test_overview_lists_chapters_in_reading_order(client, db_session):
    """Sorting by each chapter's own position interleaved acts: 1, 3, 5, 2, 4, 6."""
    story = client.post(
        "/api/stories", json={"title": "Order", "structure_template_id": "three-act", "scaffold": False}
    ).json()
    sid = story["id"]
    for a in range(2):
        act = StructureNode(story_id=sid, level=0, level_type="act", title=f"Act {a + 1}", position=a)
        db_session.add(act)
        db_session.flush()
        for c in range(2):
            ch = StructureNode(
                story_id=sid, parent_id=act.id, level=1, level_type="chapter", title=f"Ch {a * 2 + c + 1}", position=c
            )
            db_session.add(ch)
            db_session.flush()
            db_session.add(
                StructureNode(story_id=sid, parent_id=ch.id, level=2, level_type="scene", title="s", position=0)
            )
    db_session.commit()
    titles = [d["title"] for d in client.get(f"/api/stories/{sid}/overview").json()["distribution"]]
    assert titles == ["Ch 1", "Ch 2", "Ch 3", "Ch 4"]


def test_story_progress_for_dashboard_cards(client, db_session):
    story = client.post("/api/stories", json={"title": "Prog", "structure_template_id": "three-act"}).json()
    client.patch(f"/api/stories/{story['id']}", json={"intended_length": "short_story"})
    scene = db_session.get(StructureNode, story["start_node_id"])
    scene.word_count = 700
    db_session.commit()
    row = next(p for p in client.get("/api/stories/progress").json() if p["story_id"] == story["id"])
    assert row["word_count"] == 700
    assert row["last_scene_id"] == scene.id
    assert row["target_words"] and row["pct"] > 0
