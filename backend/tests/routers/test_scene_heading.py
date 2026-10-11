"""
A script scene's heading and splitting a scene (doc 25 P2, D3).

The heading is the scene's first line, typed like any other; each save reads it into the
scene's interior, time and place. A heading further down starts another scene, and the split
is one change ⌘Z takes back whole.
"""

import pytest

from app.models import Location, Note, Story
from app.models.dialogue import DialogueBlock
from app.models.location import SceneSetting
from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.script_scene import cut_at_heading, match_place
from app.services.seed import STRUCTURE_TEMPLATES


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _script(client, db_session, *places):
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    for name in places:
        db_session.add(Location(story_id=story["id"], name=name))
    db_session.commit()
    return story


def _primary(db_session, node_id):
    row = db_session.query(SceneSetting).filter_by(node_id=node_id, role="primary").first()
    return db_session.get(Location, row.location_id).name if row else None


def test_saving_reads_the_heading_and_links_its_place(client, db_session):
    story = _script(client, db_session, "Keeper's Cottage")
    node = story["start_node_id"]
    html = '<p data-el="heading">INT. KEEPER\'S COTTAGE - NIGHT</p><p data-el="action">Rain.</p>'
    out = client.patch(f"/api/structure/{node}", json={"content": html}).json()
    assert (out["interior"], out["time_of_day"]) == ("INT", "NIGHT")
    assert _primary(db_session, node) == "Keeper's Cottage"


def test_a_place_the_lorebook_does_not_have_links_nothing(client, db_session):
    story = _script(client, db_session)
    node = story["start_node_id"]
    out = client.patch(f"/api/structure/{node}", json={"content": '<p data-el="heading">EXT. ROOF - DAY</p>'}).json()
    assert out["interior"] == "EXT" and _primary(db_session, node) is None


def test_the_authors_own_place_is_kept(client, db_session):
    story = _script(client, db_session, "Keeper's Cottage", "The Lighthouse")
    node = story["start_node_id"]
    tower = db_session.query(Location).filter_by(name="The Lighthouse").one()
    db_session.add(SceneSetting(location_id=tower.id, node_id=node, role="primary"))
    db_session.commit()
    client.patch(f"/api/structure/{node}", json={"content": '<p data-el="heading">INT. KEEPER\'S COTTAGE</p>'})
    assert _primary(db_session, node) == "The Lighthouse"


def test_prose_has_no_heading_to_read(client, db_session):
    story = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    out = client.patch(
        f"/api/structure/{story['start_node_id']}", json={"content": '<p data-el="heading">INT. ROOM - DAY</p>'}
    ).json()
    assert out["interior"] == "" and out["time_of_day"] == ""


@pytest.mark.parametrize(
    ("place", "found"),
    [
        ("KEEPER'S COTTAGE", "Keeper's Cottage"),
        ("LIGHTHOUSE", "The Lighthouse"),
        ("LIGHTHOUSE, LAMP ROOM", "Lamp Room"),
        ("THE LIGHTHOUSE - GALLERY", "The Lighthouse"),
        ("THE MOON", None),
    ],
)
def test_which_place_a_heading_names(place, found):
    places = [Location(name="Keeper's Cottage"), Location(name="The Lighthouse"), Location(name="Lamp Room")]
    match = match_place(place, places)
    assert (match.name if match else None) == found


BEFORE = (
    '<p data-el="heading">INT. KEEPER\'S COTTAGE - NIGHT</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Don\'t open the door.</p>'
)
AFTER = (
    '<p data-el="heading">EXT. LIGHTHOUSE - CONTINUOUS</p>'
    '<p data-el="action">She runs <span data-note-id="n-1" class="note-anchor">into the rain</span>.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Wait!</p>'
)


def test_a_split_starts_the_next_scene_and_undoes_whole(client, db_session):
    story = _script(client, db_session, "Keeper's Cottage", "The Lighthouse")
    node_id = story["start_node_id"]
    node = db_session.get(StructureNode, node_id)
    sibling = StructureNode(
        story_id=story["id"], parent_id=node.parent_id, level=node.level, level_type="scene", title="Later", position=1
    )
    db_session.add(sibling)
    db_session.add(
        Note(id="n-1", story_id=story["id"], kind="note", node_id=node_id, anchor="into the rain", content="Wet.")
    )
    db_session.commit()
    client.patch(f"/api/structure/{node_id}", json={"content": BEFORE + AFTER})
    wait = db_session.query(DialogueBlock).filter_by(scene_id=node_id, content="Wait!").one()
    wait.subtext = "She knows already."
    wait.attribution_method = "manual"
    db_session.commit()

    r = client.post(f"/api/structure/{node_id}/split", json={"content": BEFORE, "new_content": AFTER})
    assert r.status_code == 201, r.text
    new = r.json()
    assert (new["title"], new["position"], new["interior"], new["time_of_day"]) == (
        "Lighthouse",
        1,
        "EXT",
        "CONTINUOUS",
    )
    db_session.expire_all()
    assert db_session.get(StructureNode, node_id).content == BEFORE
    assert db_session.get(StructureNode, sibling.id).position == 2
    assert _primary(db_session, new["id"]) == "The Lighthouse"
    moved = db_session.query(DialogueBlock).filter_by(content="Wait!").one()
    assert (moved.scene_id, moved.subtext) == (new["id"], "She knows already.")
    assert db_session.get(Note, "n-1").node_id == new["id"]

    assert client.post(f"/api/stories/{story['id']}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.get(StructureNode, node_id).content == BEFORE + AFTER
    assert db_session.get(StructureNode, new["id"]) is None
    assert db_session.get(StructureNode, sibling.id).position == 1
    back = db_session.query(DialogueBlock).filter_by(content="Wait!").one()
    assert (back.scene_id, back.subtext) == (node_id, "She knows already.")
    assert db_session.get(Note, "n-1").node_id == node_id


def test_a_split_refuses_a_scene_changed_since(client, db_session):
    story = _script(client, db_session)
    r = client.post(
        f"/api/structure/{story['start_node_id']}/split",
        json={"content": BEFORE, "new_content": AFTER, "expected_updated_at": "2001-01-01T00:00:00"},
    )
    assert r.status_code == 409
    assert db_session.query(Story).count() == 1


def _second_headings(client, story):
    feed = client.get(f"/api/stories/{story['id']}/findings").json()
    return [f for f in feed["findings"] if f["check"] == "second_heading"]


def test_a_second_heading_is_a_finding_whose_fix_splits_there(client, db_session):
    story = _script(client, db_session, "The Lighthouse")
    node_id = story["start_node_id"]
    client.patch(f"/api/structure/{node_id}", json={"content": BEFORE + AFTER})
    [found] = _second_headings(client, story)
    assert found["fix"]["kind"] == "split" and found["fix"]["old"] == "EXT. LIGHTHOUSE - CONTINUOUS"

    r = client.post(f"/api/stories/{story['id']}/findings/{found['id']}/fix")
    assert r.status_code == 200, r.text
    assert r.json()["node_id"] == node_id
    db_session.expire_all()
    assert db_session.get(StructureNode, node_id).content == BEFORE
    new = db_session.query(StructureNode).filter_by(story_id=story["id"], content=AFTER).one()
    assert new.interior == "EXT" and _primary(db_session, new.id) == "The Lighthouse"
    assert _second_headings(client, story) == []

    client.post(f"/api/stories/{story['id']}/undo")
    db_session.expire_all()
    assert db_session.get(StructureNode, node_id).content == BEFORE + AFTER


def test_a_single_heading_or_prose_is_no_finding(client, db_session):
    story = _script(client, db_session)
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": BEFORE})
    assert _second_headings(client, story) == []
    prose = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    client.patch(f"/api/structure/{prose['start_node_id']}", json={"content": BEFORE + AFTER})
    assert _second_headings(client, prose) == []


def test_the_cut_falls_on_the_heading_block():
    html = BEFORE + AFTER
    assert cut_at_heading(html, "EXT. LIGHTHOUSE - CONTINUOUS") == (BEFORE, AFTER)
    assert cut_at_heading(html, "INT. KEEPER'S COTTAGE - NIGHT") is None  # the scene's own heading
    assert cut_at_heading(html, "EXT. MOON - DAY") is None


def test_a_scene_may_open_on_a_transition(client, db_session):
    # Most scripts open "FADE IN:" above the first heading: the heading is still the scene's own.
    story = _script(client, db_session)
    node_id = story["start_node_id"]
    fade = '<p data-el="action">FADE IN:</p>'
    out = client.patch(f"/api/structure/{node_id}", json={"content": fade + BEFORE}).json()
    assert (out["interior"], out["time_of_day"]) == ("INT", "NIGHT")
    assert _second_headings(client, story) == []
    assert cut_at_heading(fade + BEFORE, "INT. KEEPER'S COTTAGE - NIGHT") is None


THIRD = '<p data-el="heading">INT. LAMP ROOM - LATER</p><p data-el="action">The lamp turns.</p>'


def test_scenes_pasted_at_once_each_start_at_their_heading_and_undo_whole(client, db_session):
    story = _script(client, db_session, "The Lighthouse")
    node_id = story["start_node_id"]
    client.patch(f"/api/structure/{node_id}", json={"content": BEFORE + AFTER + THIRD})

    r = client.post(f"/api/structure/{node_id}/split-headings", json={})
    assert r.status_code == 200, r.text
    assert r.json()["content"] == BEFORE
    db_session.expire_all()
    node = db_session.get(StructureNode, node_id)
    scenes = (
        db_session.query(StructureNode)
        .filter_by(story_id=story["id"], parent_id=node.parent_id)
        .order_by(StructureNode.position)
        .all()
    )
    assert [(s.title, s.content) for s in scenes] == [
        (node.title, BEFORE),
        ("Lighthouse", AFTER),
        ("Lamp Room", THIRD),
    ]
    assert _primary(db_session, scenes[1].id) == "The Lighthouse"

    assert client.post(f"/api/stories/{story['id']}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.get(StructureNode, node_id).content == BEFORE + AFTER + THIRD
    assert db_session.query(StructureNode).filter_by(story_id=story["id"], level=node.level).count() == 1

    assert (
        client.post(
            f"/api/structure/{node_id}/split-headings", json={"expected_updated_at": "2001-01-01T00:00:00"}
        ).status_code
        == 409
    )
    client.patch(f"/api/structure/{node_id}", json={"content": BEFORE})
    assert client.post(f"/api/structure/{node_id}/split-headings", json={}).status_code == 400
