"""
The Codex graph, built from what the author already wrote (refactor doc 07 §2).

The graph must not invent anything: every node stands for a row, every edge for a link the
author made or one that follows from the manuscript. And a rebuild must be safe to run at
any time — it may replace only what it generated.
"""

from app.models.character import Character, CharacterRelationship
from app.models.codex import CodexEdge, CodexNode
from app.models.location import Location, SceneSetting
from app.models.plot_thread import PlotThread, PlotThreadAppearance
from app.models.scene_link import SceneLink
from app.models.story import Story
from app.models.structure import StructureNode
from app.models.twist import Twist, TwistClue
from app.services.codex.sync import sync_story
from tests.fixtures.dialogue import attributed


def _story(db, user, title="Lighthouse"):
    story = Story(title=title, user_id=user.id)
    db.add(story)
    db.flush()
    return story


def _scene(db, story, title, position, **kw):
    node = StructureNode(story_id=story.id, title=title, level=0, level_type="scene", position=position, **kw)
    db.add(node)
    db.flush()
    return node


def _character(db, story, name):
    c = Character(story_id=story.id, name=name)
    db.add(c)
    db.flush()
    return c


def _edges(db, kind):
    return db.query(CodexEdge).filter(CodexEdge.kind == kind).all()


def _labels(db, kind):
    return sorted(n.label for n in db.query(CodexNode).filter(CodexNode.kind == kind))


def test_every_authored_thing_becomes_a_node(db_session, test_user):
    story = _story(db_session, test_user)
    _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0)
    db_session.add(Location(story_id=story.id, name="The Lighthouse"))
    db_session.add(PlotThread(story_id=story.id, name="The missing keeper"))
    db_session.add(Twist(story_id=story.id, name="The light was out"))
    db_session.commit()

    report = sync_story(story.id, db_session)
    assert _labels(db_session, "character") == ["Elena"]
    assert _labels(db_session, "scene") == ["Arrival"]
    assert _labels(db_session, "location") == ["The Lighthouse"]
    assert _labels(db_session, "thread") == ["The missing keeper"]
    assert _labels(db_session, "twist") == ["The light was out"]
    assert report.nodes == 5


def test_author_links_become_edges(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    mara = _character(db_session, story, "Mara")
    scene = _scene(db_session, story, "The Lamp Room", 0, pov_character_id=elena.id)
    lighthouse = Location(story_id=story.id, name="The Lighthouse")
    thread = PlotThread(story_id=story.id, name="The missing keeper")
    db_session.add_all([lighthouse, thread])
    db_session.flush()
    db_session.add(
        CharacterRelationship(character_id=elena.id, related_character_id=mara.id, relationship_type="sister")
    )
    db_session.add(SceneSetting(node_id=scene.id, location_id=lighthouse.id, role="primary"))
    db_session.add(PlotThreadAppearance(thread_id=thread.id, node_id=scene.id))
    db_session.commit()

    sync_story(story.id, db_session)
    assert len(_edges(db_session, "rel")) == 1
    assert _edges(db_session, "rel")[0].props["type"] == "sister"
    assert len(_edges(db_session, "pov")) == 1
    assert _edges(db_session, "at")[0].props["role"] == "primary"
    assert len(_edges(db_session, "advances")) == 1


def test_reading_order_and_speakers_are_derived_not_authored(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    first = _scene(db_session, story, "Arrival", 0)
    second = _scene(db_session, story, "The Lamp Room", 1, content='<p>"Who\'s there?"</p>')
    db_session.add(attributed(second, elena, "Who's there?"))
    db_session.commit()

    sync_story(story.id, db_session)
    follows = _edges(db_session, "follows")
    assert len(follows) == 1 and follows[0].source == "derived"
    speaks = _edges(db_session, "speaks_in")
    assert len(speaks) == 1 and speaks[0].source == "derived"
    # Order is the manuscript's, not the row order.
    src = db_session.get(CodexNode, follows[0].src_id)
    assert src.ref_id == first.id and second.id == db_session.get(CodexNode, follows[0].dst_id).ref_id


def test_a_clue_with_no_scene_is_not_an_edge(db_session, test_user):
    """A clue not yet placed in a scene (doc 18 C1: clues are rows) draws no clue_in edge."""
    story = _story(db_session, test_user)
    scene = _scene(db_session, story, "Arrival", 0)
    db_session.add(
        Twist(
            story_id=story.id,
            name="The light was out",
            clues=[TwistClue(node_id=scene.id, text="the unlit lamp"), TwistClue(text="a torn page", position=1)],
        )
    )
    db_session.commit()

    sync_story(story.id, db_session)
    assert len(_edges(db_session, "clue_in")) == 1


def test_scene_links_become_edges(db_session, test_user):
    story = _story(db_session, test_user)
    first = _scene(db_session, story, "Arrival", 0)
    second = _scene(db_session, story, "The Wreck", 1)
    db_session.add(
        SceneLink(story_id=story.id, source_node_id=second.id, target_node_id=first.id, link_type="callback")
    )
    db_session.commit()

    sync_story(story.id, db_session)
    links = _edges(db_session, "links")
    assert len(links) == 1 and links[0].props["type"] == "callback"


def test_syncing_twice_changes_nothing(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    _scene(db_session, story, "Arrival", 0, pov_character_id=elena.id)
    db_session.commit()

    first = sync_story(story.id, db_session)
    node_ids = {n.id for n in db_session.query(CodexNode).all()}
    second = sync_story(story.id, db_session)

    assert (first.nodes, first.edges) == (second.nodes, second.edges)
    # Ids are kept, so anything pointing at a node still points at it.
    assert node_ids == {n.id for n in db_session.query(CodexNode).all()}


def test_a_rebuild_leaves_unconfirmed_proposals_alone(db_session, test_user):
    """An `llm` edge is a proposal awaiting the author; a sync may not quietly drop it."""
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "Arrival", 0)
    db_session.commit()
    sync_story(story.id, db_session)

    char_node = db_session.query(CodexNode).filter(CodexNode.ref_id == elena.id).one()
    scene_node = db_session.query(CodexNode).filter(CodexNode.ref_id == scene.id).one()
    db_session.add(CodexEdge(story_id=story.id, src_id=char_node.id, dst_id=scene_node.id, kind="knows", source="llm"))
    db_session.commit()

    sync_story(story.id, db_session)
    assert len(_edges(db_session, "knows")) == 1


def test_the_authors_presence_answer_survives_a_rebuild(db_session, test_user):
    """It survives because it lives in the Lorebook, not in the graph (doc 07 §3)."""
    from app.services.codex.presence import set_presence

    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    scene = _scene(db_session, story, "Arrival", 0, content="<p>They spoke of Elena.</p>")
    db_session.commit()
    sync_story(story.id, db_session)

    set_presence(scene.id, elena.id, "absent", db_session)
    sync_story(story.id, db_session)
    edge = _edges(db_session, "present_in")[0]
    assert edge.props == {"basis": "manual", "role": "absent"}
    assert edge.source == "author"


def test_removing_a_character_removes_its_node(db_session, test_user):
    story = _story(db_session, test_user)
    elena = _character(db_session, story, "Elena")
    db_session.commit()
    sync_story(story.id, db_session)
    assert _labels(db_session, "character") == ["Elena"]

    db_session.delete(elena)
    db_session.commit()
    sync_story(story.id, db_session)
    assert _labels(db_session, "character") == []
