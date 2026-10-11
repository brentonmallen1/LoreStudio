"""
Adapting a novel as a script (doc 25, P10): a new story in the novel's series with the novel's
outline and its Lorebook shared, each scene opening on the heading its place gives it and
remembering the novel's scene it tells. Nothing the author wrote is converted.
"""

from app.models import Location, PlotThread, Story, Twist
from app.models.location import SceneSetting
from app.models.plot_thread import PlotThreadAppearance
from app.models.structure import StructureNode
from app.models.twist import TwistClue
from app.services.adaptation import based_on, interior_of
from app.services.series import service
from tests.fixtures.series_factory import make_book

PROSE = "<p>The rain came sideways. “Don’t open the door,” Eleanor said.</p>"


def _novel(db, user):
    one = make_book(db, user)
    one.story.author_name = "A. Writer"
    one.story.logline = "A keeper lets a stranger in from a storm."
    s = one.story.id

    def node(title, level, level_type, position, parent=None, content=""):
        n = StructureNode(
            story_id=s,
            parent_id=parent.id if parent else None,
            level=level,
            level_type=level_type,
            title=title,
            position=position,
            content=content,
            status="draft",
            synopsis=f"{title}, planned.",
        )
        db.add(n)
        db.flush()
        return n

    act_one = node("Act One", 0, "act", 0)
    chapter = node("The Storm", 1, "chapter", 0, act_one)
    door = node("The Door", 2, "scene", 0, chapter, PROSE)
    cliff = node("The Cliff", 2, "scene", 1, chapter, "<p>She walks the cliff.</p>")
    act_two = node("Act Two", 0, "act", 1)
    dawn = node("Dawn", 1, "scene", 0, act_two, "<p>Morning.</p>")
    db.add(SceneSetting(location_id=one.lighthouse.id, node_id=door.id, role="primary"))
    db.add(SceneSetting(location_id=one.coast.id, node_id=cliff.id, role="primary"))
    thread = PlotThread(story_id=s, name="The missing month")
    twist = Twist(story_id=s, name="She is his daughter", revealed_at_node_id=dawn.id)
    db.add_all([thread, twist])
    db.flush()
    db.add(PlotThreadAppearance(thread_id=thread.id, node_id=door.id, role="opens"))
    db.add(PlotThreadAppearance(thread_id=thread.id, node_id=dawn.id, role="closes"))
    db.add(TwistClue(twist_id=twist.id, node_id=door.id, text="She knows the song."))
    db.commit()
    return one, {"door": door, "cliff": cliff, "dawn": dawn}


def _adapt(client, story_id, **body):
    carry = client.get(f"/api/stories/{story_id}/adapt/carry").json()
    items = [{"kind": c["kind"], "ref_id": c["ref_id"]} for c in carry if c["preselect"]]
    r = client.post(f"/api/stories/{story_id}/adapt", json={"carry": items, **body})
    assert r.status_code == 201, r.text
    return r.json()


def _scenes(db, story_id):
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    return {n.title: n for n in nodes}


def test_a_novel_becomes_a_screenplay_beside_it_in_its_series(client, db_session, test_user):
    one, novel = _novel(db_session, test_user)
    out = _adapt(client, one.story.id)

    script = db_session.get(Story, out["id"])
    assert (script.title, script.story_format, script.adapted_from_id) == (
        "The Last Lighthouse: The Screenplay",
        "screenplay",
        one.story.id,
    )
    assert script.title_page["based_on"] == "Based on the novel “The Last Lighthouse” by A. Writer"
    assert script.logline == one.story.logline and script.author_name == "A. Writer"
    series = client.get(f"/api/series/{out['series_id']}").json()
    assert [b["title"] for b in series["books"]] == ["The Last Lighthouse", "The Last Lighthouse: The Screenplay"]
    assert service.membership(db_session, script.id).role == "“The Last Lighthouse” told as a screenplay."

    # The outline, every level, each scene planned, its text only the heading its place gives.
    scenes = _scenes(db_session, script.id)
    assert set(scenes) == {"Act One", "The Storm", "The Door", "The Cliff", "Act Two", "Dawn"}
    door, cliff, dawn = scenes["The Door"], scenes["The Cliff"], scenes["Dawn"]
    assert door.parent_id == scenes["The Storm"].id and door.synopsis == "The Door, planned."
    assert door.content == '<p data-el="heading">INT. THE LIGHTHOUSE</p>' and door.status == "planned"
    assert cliff.content == '<p data-el="heading">EXT. THE COAST</p>' and cliff.interior == "EXT"
    assert dawn.content == "" and scenes["Act One"].status == "draft"
    assert (door.adapted_from_id, dawn.adapted_from_id) == (novel["door"].id, novel["dawn"].id)
    assert out["start_node_id"] == door.id

    # The Lorebook shared, and each scene's place, threads and twists on the script's own rows.
    places = {p.id: p.name for p in db_session.query(Location).filter(Location.story_id == script.id)}
    setting = db_session.query(SceneSetting).filter(SceneSetting.node_id == door.id).one()
    assert places[setting.location_id] == "The Lighthouse"
    thread = db_session.query(PlotThread).filter(PlotThread.story_id == script.id).one()
    assert {(a.node_id, a.role) for a in thread.appearances} == {(door.id, "opens"), (dawn.id, "closes")}
    twist = db_session.query(Twist).filter(Twist.story_id == script.id).one()
    assert twist.revealed_at_node_id == dawn.id
    assert db_session.query(TwistClue).filter(TwistClue.twist_id == twist.id).one().node_id == door.id

    # The novel's own words are untouched.
    assert db_session.get(StructureNode, novel["door"].id).content == PROSE


def test_the_whole_lorebook_is_offered_even_a_closed_thread(client, db_session, test_user):
    one, _ = _novel(db_session, test_user)
    carry = client.get(f"/api/stories/{one.story.id}/adapt/carry").json()
    assert all(c["preselect"] for c in carry)
    assert {"Eleanor", "The Lighthouse", "The missing month", "She is his daughter"} <= {c["name"] for c in carry}
    sequel = client.get(f"/api/stories/{one.story.id}/carry-over").json()
    assert "The missing month" not in {c["name"] for c in sequel}  # a sequel leaves a closed thread behind


def test_a_play_numbers_its_scenes_and_marks_each_act_after_the_first(client, db_session, test_user):
    one, _ = _novel(db_session, test_user)
    out = _adapt(client, one.story.id, story_format="stage_play")
    scenes = _scenes(db_session, out["id"])
    assert out["title"] == "The Last Lighthouse: A Play"
    assert scenes["The Door"].content == '<p data-el="heading">SCENE 1</p>'
    assert scenes["The Cliff"].content == '<p data-el="heading">SCENE 2</p>'
    assert scenes["Dawn"].content == '<p data-el="heading">ACT TWO</p><p data-el="heading">SCENE 1</p>'


def test_only_a_novel_is_adapted(client, db_session, test_user):
    one, _ = _novel(db_session, test_user)
    script = _adapt(client, one.story.id)
    r = client.post(f"/api/stories/{script['id']}/adapt", json={})
    assert r.status_code == 400 and "already a script" in r.json()["detail"]
    r = client.post(f"/api/stories/{one.story.id}/adapt", json={"story_format": "prose"})
    assert r.status_code in (400, 422)


def test_a_scene_can_be_pointed_at_another_of_the_novels_scenes_only(client, db_session, test_user):
    one, novel = _novel(db_session, test_user)
    script = _adapt(client, one.story.id)
    door = _scenes(db_session, script["id"])["The Door"]
    r = client.patch(f"/api/structure/{door.id}", json={"adapted_from_id": novel["cliff"].id})
    assert r.status_code == 200 and r.json()["adapted_from_id"] == novel["cliff"].id
    r = client.patch(f"/api/structure/{door.id}", json={"adapted_from_id": door.id})
    assert r.status_code == 400
    assert client.post(f"/api/stories/{script['id']}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.get(StructureNode, door.id).adapted_from_id == novel["door"].id


def test_headings_and_credits_read_the_novel():
    class Place:
        def __init__(self, name, kind=""):
            self.name, self.location_type = name, kind

    assert interior_of(Place("Keeper's Cottage", "building")) == "INT"
    assert interior_of(Place("The Harbour")) == "EXT" and interior_of(Place("Gull Rock", "island")) == "EXT"
    assert based_on(Story(title="Light", author_name="")) == "Based on the novel “Light”"


def test_the_script_retells_the_novels_promises_rather_than_continuing_them(client, db_session, test_user):
    from app.services.series.promises import across

    one, _ = _novel(db_session, test_user)
    script = _adapt(client, one.story.id)
    assert across(db_session, script["id"]) is None
    assert across(db_session, one.story.id) is not None
