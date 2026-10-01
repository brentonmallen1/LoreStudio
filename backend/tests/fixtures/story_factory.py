"""Build a story that touches every story-owned table.

Used by the delete-completeness and snapshot round-trip tests: if a new model is
added and this factory is not updated, ``test_snapshot_completeness`` still
fails (it walks ``Base.metadata``), which is the point.
"""

import uuid

from sqlalchemy.orm import Session

from app.models import (
    ActivityLog,
    AIJob,
    AssetAttachment,
    Calendar,
    Character,
    CharacterInterview,
    CharacterJourneySummary,
    CharacterRelationship,
    ChatMessage,
    ChatSession,
    CompendiumAttachment,
    CompendiumEntry,
    Culture,
    Diagram,
    DialogueBlock,
    DiscoveredElement,
    Era,
    FindingDismissal,
    HistoricalEvent,
    Location,
    LocationTravel,
    Outline,
    OutlineItem,
    PanelInterview,
    PlotThread,
    PlotThreadAppearance,
    ReaderKnowledgeEvent,
    SceneLink,
    ScenePresence,
    SceneSetting,
    Setting,
    Story,
    StoryAsset,
    StoryNote,
    StoryTodo,
    StructureNode,
    Twist,
    WorldSystem,
)
from app.models.user import User


def _uid() -> str:
    return str(uuid.uuid4())


def build_full_story(db: Session, user: User, title: str = "Factory Story") -> Story:  # noqa: PLR0915
    """Create one row in every story-owned table and return the Story."""
    story = Story(id=_uid(), user_id=user.id, title=title, goals=[{"id": _uid(), "text": "g", "completed": False}])
    db.add(story)
    db.flush()
    sid = story.id

    hero = Character(id=_uid(), story_id=sid, name="Mara", role="protagonist")
    foil = Character(id=_uid(), story_id=sid, name="Tomas", role="antagonist")
    db.add_all([hero, foil])
    db.flush()
    story.pov_character_id = hero.id

    chapter = StructureNode(id=_uid(), story_id=sid, title="Ch 1", level=0, level_type="chapter", position=0)
    db.add(chapter)
    db.flush()
    scene1 = StructureNode(
        id=_uid(),
        story_id=sid,
        parent_id=chapter.id,
        title="Lamp",
        level=1,
        level_type="scene",
        position=0,
        content='<p>"We should go," said Mara.</p>',
        pov_character_id=hero.id,
        purpose="setup",
        inline_notes=[{"id": "n1", "note": "keep"}],
        metadata_={"mice_opens": "q"},
    )
    scene2 = StructureNode(
        id=_uid(),
        story_id=sid,
        parent_id=chapter.id,
        title="Storm",
        level=1,
        level_type="scene",
        position=1,
        content="<p>Rain.</p>",
    )
    db.add_all([scene1, scene2])
    db.flush()

    db.add(
        CharacterRelationship(id=_uid(), character_id=hero.id, related_character_id=foil.id, relationship_type="rival")
    )
    db.add(CharacterInterview(id=_uid(), character_id=hero.id))
    db.add(CharacterJourneySummary(id=_uid(), character_id=hero.id, up_to_node_id=scene1.id, summary="So far"))
    db.add(DialogueBlock(id=_uid(), scene_id=scene1.id, character_id=hero.id, content="We should go"))

    thread = PlotThread(id=_uid(), story_id=sid, name="Escape")
    db.add(thread)
    db.flush()
    db.add(PlotThreadAppearance(id=_uid(), thread_id=thread.id, node_id=scene1.id))

    twist = Twist(id=_uid(), story_id=sid, name="Betrayal", revealed_at_node_id=scene2.id)
    db.add(twist)
    db.flush()
    db.add(ReaderKnowledgeEvent(id=_uid(), story_id=sid, node_id=scene2.id, twist_id=twist.id, subject="Tomas lied"))

    harbour = Location(id=_uid(), story_id=sid, name="Harbour")
    tower = Location(id=_uid(), story_id=sid, name="Tower")
    db.add_all([harbour, tower])
    db.flush()
    db.add(SceneSetting(id=_uid(), location_id=harbour.id, node_id=scene1.id))
    db.add(LocationTravel(id=_uid(), from_location_id=harbour.id, to_location_id=tower.id))

    db.add(WorldSystem(id=_uid(), story_id=sid, name="Tides"))
    db.add(Culture(id=_uid(), story_id=sid, name="Islanders"))
    era = Era(id=_uid(), story_id=sid, name="Before")
    db.add(era)
    db.flush()
    db.add(HistoricalEvent(id=_uid(), story_id=sid, era_id=era.id, name="The Flood"))
    db.add(Calendar(id=_uid(), story_id=sid, name="Tide calendar"))
    db.add(Setting(id=_uid(), story_id=sid, name="Old setting"))
    db.add(StoryNote(id=_uid(), story_id=sid))
    db.add(StoryTodo(id=_uid(), story_id=sid, node_id=scene1.id, content="fix pacing"))
    db.add(SceneLink(id=_uid(), story_id=sid, source_node_id=scene1.id, target_node_id=scene2.id, link_type="callback"))
    db.add(DiscoveredElement(id=_uid(), story_id=sid, source_node_id=scene1.id, element_type="character", name="Gull"))
    db.add(FindingDismissal(id=_uid(), story_id=sid, fingerprint="fp-intended", node_content_hash=None))
    db.add(Diagram(id=_uid(), story_id=sid, title="Map"))
    db.add(PanelInterview(id=_uid(), story_id=sid))

    asset = StoryAsset(
        id=_uid(),
        story_id=sid,
        user_id=user.id,
        original_filename="a.png",
        stored_path="x/a.png",
        mime_type="image/png",
    )
    db.add(asset)
    db.flush()
    db.add(AssetAttachment(id=_uid(), asset_id=asset.id, object_type="character", object_id=hero.id))
    entry = CompendiumEntry(id=_uid(), story_id=sid, title="Research", entry_type="note", asset_id=asset.id)
    db.add(entry)
    db.flush()
    db.add(CompendiumAttachment(id=_uid(), entry_id=entry.id, object_type="character", object_id=hero.id))

    outline = Outline(id=_uid(), story_id=sid, name="Main")
    db.add(outline)
    db.flush()
    root_item = OutlineItem(id=_uid(), outline_id=outline.id, text="Act 1")
    db.add(root_item)
    db.flush()
    db.add(OutlineItem(id=_uid(), outline_id=outline.id, parent_id=root_item.id, level=1, text="Beat"))

    session = ChatSession(id=_uid(), story_id=sid, user_id=user.id, context_type="story", context_label="Story")
    db.add(session)
    db.flush()
    db.add(ChatMessage(id=_uid(), session_id=session.id, role="user", content="hi"))
    db.add(ActivityLog(id=_uid(), user_id=user.id, story_id=sid, event_type="test", category="ai", description="x"))
    db.add(ScenePresence(id=_uid(), node_id=scene1.id, character_id=hero.id, role="participant"))
    db.add(AIJob(id=_uid(), user_id=user.id, story_id=sid, kind="scene-summaries", label="Scene summaries"))

    db.commit()
    db.refresh(story)
    return story


def story_owned_tables(metadata) -> list[str]:
    """Names of tables that carry a story_id column, excluding the snapshot machinery."""
    from app.services.snapshot_service import SNAPSHOT_EXCLUDED_TABLES

    return sorted(
        t.name for t in metadata.sorted_tables if "story_id" in t.c and t.name not in SNAPSHOT_EXCLUDED_TABLES
    )
