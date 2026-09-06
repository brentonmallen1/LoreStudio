"""
What a character knows, and when (refactor doc 06 §6, v1).

An interview used to hand the character a journey summary built from every scene that
merely *named* them, and nothing told them where their knowledge stopped — so a character
would happily discuss a scene they were not in, or events after the point the author was
asking about. This module answers a narrower question: which scenes was this character
present for, up to a given point in the story, and what were they told there.

v1 derives presence from what the author has already recorded: point of view, attributed
dialogue, and their name in the prose. v2 (doc 07 §3) replaces this with Codex edges,
author overrides, and offscreen knowledge links.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.structure import StructureNode
from .character_journey import get_nodes_up_to

#: Why we believe the character was in a scene, most authoritative first.
POV = "point of view"
SPEAKS = "speaks in the scene"
NAMED = "named in the prose"


@dataclass(frozen=True)
class ScenePresence:
    node_id: str
    title: str
    reasons: tuple[str, ...]
    summary: str | None = None


#: How much of the story a character may draw on.
PROFILE_ONLY = "profile"
WHOLE_STORY = "story"
AS_OF = "as_of"


@dataclass
class KnowledgeScope:
    """The scenes a character was present for and what they learned, up to a point."""

    #: "profile" | "story" | "as_of"
    mode: str = WHOLE_STORY
    as_of_node_id: str | None = None
    as_of_title: str | None = None
    scenes: list[ScenePresence] = field(default_factory=list)
    #: Reader-knowledge events this character is recorded as knowing.
    facts: list[dict] = field(default_factory=list)
    #: How many scenes exist up to the cutoff, present or not — the denominator that
    #: makes "3 of 18 scenes" honest.
    scenes_considered: int = 0


def _leaf_scenes(nodes: list[StructureNode]) -> list[StructureNode]:
    """Scenes only: acts and chapters are containers, not places a character can be."""
    parent_ids = {n.parent_id for n in nodes if n.parent_id}
    return [n for n in nodes if n.id not in parent_ids]


def build_scope(
    character: Character,
    db: Session,
    as_of_node_id: str | None = None,
    mode: str = WHOLE_STORY,
) -> KnowledgeScope:
    """
    Presence up to `as_of_node_id` (inclusive), or across the whole story.

    `mode="profile"` is the deliberate empty case: an interview held outside the story, where
    the character is only their profile. It is not the same as having appeared in no scenes,
    and the prompt says so differently.

    Otherwise this is the union of three signals the author has already given us. Nothing
    here guesses at offscreen knowledge: if the author has not recorded it, the character
    does not know it, and the interview prompt says so out loud.
    """
    if mode == PROFILE_ONLY:
        return KnowledgeScope(mode=PROFILE_ONLY)
    if as_of_node_id:
        nodes = get_nodes_up_to(character.story_id, as_of_node_id, db)
    else:
        nodes = (
            db.query(StructureNode)
            .filter(StructureNode.story_id == character.story_id)
            .order_by(StructureNode.position)
            .all()
        )
    scenes = _leaf_scenes(nodes)
    scene_ids = {n.id for n in scenes}

    speaking_scene_ids = {
        row[0]
        for row in db.query(DialogueBlock.scene_id).filter(DialogueBlock.character_id == character.id).all()
        if row[0] in scene_ids
    }

    name = (character.name or "").lower()
    present: list[ScenePresence] = []
    for node in scenes:
        reasons: list[str] = []
        if node.pov_character_id == character.id:
            reasons.append(POV)
        if node.id in speaking_scene_ids:
            reasons.append(SPEAKS)
        if name and name in (node.content or "").lower():
            reasons.append(NAMED)
        if reasons:
            present.append(
                ScenePresence(
                    node_id=node.id,
                    title=node.title,
                    reasons=tuple(reasons),
                    summary=node.content_summary or None,
                )
            )

    as_of_title = None
    if as_of_node_id:
        node = db.get(StructureNode, as_of_node_id)
        as_of_title = node.title if node else None

    return KnowledgeScope(
        mode=AS_OF if as_of_node_id else WHOLE_STORY,
        as_of_node_id=as_of_node_id,
        as_of_title=as_of_title,
        scenes=present,
        facts=_facts_known(character, {p.node_id for p in present}, db),
        scenes_considered=len(scenes),
    )


def _facts_known(character: Character, present_node_ids: set[str], db: Session) -> list[dict]:
    """
    Reader-knowledge events this character knows: the ones the author listed them on, plus
    what happened in scenes they narrate. Being in the room is not knowing — a clue planted
    for the reader stays the reader's.
    """
    events = db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == character.story_id).all()
    known = []
    for event in events:
        listed = character.id in (event.characters_who_know or [])
        in_their_scene = event.node_id in present_node_ids and event.knowledge_type == "character_learns"
        if listed or in_their_scene:
            known.append({"subject": event.subject, "detail": event.detail, "is_truth": event.is_truth})
    return known


def describe_scope(character: Character, scope: KnowledgeScope) -> str:
    """
    The knowledge block for the interview prompt: what they were there for, what they were
    told, and — the part that was missing — that everything else is outside their reach.
    """
    if scope.mode == PROFILE_ONLY:
        # Not "you have been in no scenes" — this is a conversation held outside the book.
        return (
            "\n\nThis conversation happens outside the story. You are yourself — your history, "
            "your voice, what you want — but you are not being asked about the plot, and you have "
            "not lived any of it here. If the author asks what happens in the story, or what you "
            "did in a particular scene, say that you could not tell them: this is not that "
            "conversation. Talk about who you are instead."
        )

    lines = [f"\n\nWhat you have been present for{f' (up to {scope.as_of_title})' if scope.as_of_title else ''}:"]
    if scope.scenes:
        for s in scope.scenes:
            why = ", ".join(s.reasons)
            lines.append(f"- {s.title} ({why})" + (f": {s.summary}" if s.summary else ""))
    else:
        lines.append("- Nothing yet. You have not appeared in any scene the author has written.")

    if scope.facts:
        lines.append("\nWhat you know:")
        for fact in scope.facts:
            hedge = "" if fact.get("is_truth", True) else " (you believe this, but it is not true)"
            detail = f": {fact['detail']}" if fact.get("detail") else ""
            lines.append(f"- {fact['subject']}{hedge}{detail}")

    lines.append(
        "\nYou do not know anything outside these scenes"
        + (f", and nothing that happens after {scope.as_of_title}" if scope.as_of_title else "")
        + ". If the author asks about something you were not present for, say you were not "
        "there or do not know — do not reconstruct it, and do not pretend to remember. "
        "You may of course say what you would guess, as long as you name it as a guess."
    )
    return "\n".join(lines)
