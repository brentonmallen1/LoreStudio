"""
Character Journey Service

Builds and caches first-person journey summaries for characters — what they've
experienced in the story up to a given scene. These summaries are fed into the
character interview system prompt so the character can respond with story awareness.

Caching strategy:
- One CharacterJourneySummary per (character, up_to_node) pair
- is_stale = True when any source scene has been re-summarized
- Force-refresh always regenerates and updates the cache
"""
from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.structure import StructureNode
from ..models.character_journey import CharacterJourneySummary


def get_nodes_up_to(story_id: str, up_to_node_id: str, db: Session) -> list[StructureNode]:
    """Return all leaf nodes in the story up to and including the given node, in position order."""
    all_nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story_id)
        .order_by(StructureNode.position)
        .all()
    )

    # Build children map once — O(N) instead of O(N²) lookup inside flatten
    child_map: dict[str | None, list[StructureNode]] = {}
    for n in all_nodes:
        child_map.setdefault(n.parent_id, []).append(n)

    def flatten(parent_id: str | None) -> list[StructureNode]:
        result = []
        for n in sorted(child_map.get(parent_id, []), key=lambda x: x.position):
            result.append(n)
            result.extend(flatten(n.id))
        return result

    ordered = flatten(None)

    # Collect up to and including target
    result = []
    for node in ordered:
        result.append(node)
        if node.id == up_to_node_id:
            break
    return result


def get_scenes_with_character(
    nodes: list[StructureNode], character: Character
) -> list[StructureNode]:
    """Filter to nodes that mention the character by name and have a content summary."""
    name = character.name.lower()
    return [
        n for n in nodes
        if n.content_summary and name in (n.content or "").lower()
    ]


def get_cached_journey(
    character_id: str, up_to_node_id: str, db: Session
) -> CharacterJourneySummary | None:
    return (
        db.query(CharacterJourneySummary)
        .filter(
            CharacterJourneySummary.character_id == character_id,
            CharacterJourneySummary.up_to_node_id == up_to_node_id,
        )
        .first()
    )


def build_journey_prompt(character: Character, scene_summaries: list[tuple[str, str]]) -> str:
    """
    scene_summaries: list of (scene_title, summary_text)
    Returns a prompt that produces a first-person character journey summary.
    """
    scenes_text = "\n\n".join(
        f"[{title}]: {summary}" for title, summary in scene_summaries
    )
    return (
        f"You are summarizing what {character.name} has experienced in the story so far.\n\n"
        f"Scene summaries where they appear:\n{scenes_text}\n\n"
        f"Write a first-person summary (2-4 sentences) from {character.name}'s perspective. "
        f"Start with 'So far, I have...' and describe what they have done, witnessed, learned, or felt. "
        "Be specific to the events in these scenes. Write in present perfect tense."
    )


def save_journey(
    character_id: str,
    up_to_node_id: str,
    summary: str,
    source_node_ids: list[str],
    db: Session,
    existing: CharacterJourneySummary | None = None,
) -> CharacterJourneySummary:
    """Upsert a journey summary cache entry."""
    source_ids_str = ",".join(source_node_ids)
    if existing:
        existing.summary = summary
        existing.source_node_ids = source_ids_str
        existing.is_stale = False
        db.commit()
        db.refresh(existing)
        return existing
    else:
        journey = CharacterJourneySummary(
            character_id=character_id,
            up_to_node_id=up_to_node_id,
            summary=summary,
            source_node_ids=source_ids_str,
            is_stale=False,
        )
        db.add(journey)
        db.commit()
        db.refresh(journey)
        return journey
