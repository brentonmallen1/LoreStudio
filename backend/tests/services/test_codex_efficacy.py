"""
Does the Codex actually know who knows what? (doc 07 §7)

These are the checks the whole stage exists to pass. A knowledge graph that puts the wrong
character in the room is worse than no graph at all: the author would catch a persona that
knew nothing, and would not catch one that knew slightly too much.
"""

from app.models.character import Character
from app.models.codex import CodexChunk, CodexEdge, CodexNode
from app.models.interview import CharacterInterview
from app.models.location import Location, SceneSetting
from app.models.reader_knowledge import ReaderKnowledgeEvent
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.context import assemble_interview, retrieve_with_vector
from app.services.codex.embeddings import pack
from app.services.codex.presence import derive_facts, derive_presence
from app.services.codex.sync import sync_story
from tests.fixtures.dialogue import attributed

THE_SECRET = "The keeper drowned three winters ago"


def _lighthouse(db, user):
    """Seven scenes. The seventh reveals a secret to the two characters who are in it."""
    story = Story(title="The Last Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()

    elena = Character(story_id=story.id, name="Elena", role="protagonist")
    mara = Character(story_id=story.id, name="Mara", role="ally")
    tomas = Character(story_id=story.id, name="Tomas", role="antagonist")
    db.add_all([elena, mara, tomas])
    db.flush()

    scenes = []
    for i in range(6):
        node = StructureNode(
            story_id=story.id,
            title=f"Scene {i + 1}",
            level=0,
            level_type="scene",
            position=i,
            content="<p>The tide came in.</p>",
        )
        db.add(node)
        scenes.append(node)
    reveal = StructureNode(
        story_id=story.id,
        title="The Lamp Room",
        level=0,
        level_type="scene",
        position=6,
        pov_character_id=elena.id,
        content='<p>The logbook lay open. Tomas was spoken of, but not there. "Then who lit the lamp?"</p>',
    )
    db.add(reveal)
    db.flush()
    scenes.append(reveal)

    # Mara is in the room because she speaks; Tomas is only named in the prose.
    db.add(attributed(reveal, mara, "Then who lit the lamp?"))
    db.add(
        ReaderKnowledgeEvent(
            story_id=story.id,
            node_id=reveal.id,
            subject=THE_SECRET,
            detail="The light has been lit by someone else ever since.",
            knowledge_type="character_learns",
        )
    )
    db.commit()

    sync_story(story.id, db)
    derive_presence(story.id, db)
    derive_facts(story.id, db)
    return story, elena, mara, tomas, reveal


def _knowers(db, story):
    fact = db.query(CodexNode).filter(CodexNode.story_id == story.id, CodexNode.kind == "fact").one()
    edges = db.query(CodexEdge).filter(CodexEdge.kind == "knows", CodexEdge.dst_id == fact.id).all()
    names = {db.get(CodexNode, e.src_id).label for e in edges}
    return names


def test_a_fact_reaches_exactly_the_characters_who_were_there(db_session, test_user):
    story, _, _, _, _ = _lighthouse(db_session, test_user)
    # Elena narrates the scene and Mara speaks in it. Tomas is talked about.
    assert _knowers(db_session, story) == {"Elena", "Mara"}


async def test_the_character_who_was_only_mentioned_is_not_told_the_secret(db_session, test_user):
    """The interview prompt is where a leak would actually reach the author."""
    story, elena, _, tomas, reveal = _lighthouse(db_session, test_user)

    for character, should_know in ((elena, True), (tomas, False)):
        interview = CharacterInterview(character_id=character.id, context_node_id=reveal.id, knowledge_scope="as_of")
        db_session.add(interview)
        db_session.commit()
        prompt = (await assemble_interview(interview, character, db_session)).prompt
        assert (THE_SECRET in prompt) is should_know, character.name


async def test_an_interview_outside_the_story_carries_no_scenes_at_all(db_session, test_user):
    story, elena, _, _, reveal = _lighthouse(db_session, test_user)
    interview = CharacterInterview(character_id=elena.id, context_node_id=reveal.id, knowledge_scope="profile")
    db_session.add(interview)
    db_session.commit()

    prompt = (await assemble_interview(interview, elena, db_session)).prompt
    assert THE_SECRET not in prompt
    assert "The Lamp Room" not in prompt
    assert "this is not that conversation" in prompt


def test_retrieval_prefers_a_scene_set_somewhere_over_one_that_mentions_it(db_session, test_user):
    """
    Doc 07 §7's retrieval check.

    Both passages score identically on purpose: the question is whether the graph decides
    what is searched. A scene *set* at the lighthouse is one hop from it; a scene that only
    says the word is not connected at all, and never reaches the ranking.
    """
    story, _, _, _, reveal = _lighthouse(db_session, test_user)
    lighthouse = Location(story_id=story.id, name="The Lighthouse")
    db_session.add(lighthouse)
    db_session.flush()
    db_session.add(SceneSetting(node_id=reveal.id, location_id=lighthouse.id, role="primary"))
    db_session.commit()
    sync_story(story.id, db_session)

    nodes = {n.ref_id: n for n in db_session.query(CodexNode).filter(CodexNode.story_id == story.id)}
    set_there = nodes[reveal.id]
    merely_named = nodes[db_session.query(StructureNode).filter(StructureNode.position == 0).one().id]
    for node, text in ((set_there, "the lamp room"), (merely_named, "she thought of the lighthouse")):
        db_session.add(
            CodexChunk(
                story_id=story.id,
                node_id=node.id,
                chunk_index=0,
                text=text,
                token_count=4,
                embedding=pack([1.0, 0.0]),
                embed_model="test-embed",
                dim=2,
            )
        )
    db_session.commit()

    blocks = retrieve_with_vector(
        db_session,
        story.id,
        [1.0, 0.0],
        seed_ref_ids=[lighthouse.id],
        kinds=("at",),
        model="test-embed",
    )
    assert [b.node_id for b in blocks] == [set_there.id]
    assert blocks[0].why == "set in The Lighthouse"
