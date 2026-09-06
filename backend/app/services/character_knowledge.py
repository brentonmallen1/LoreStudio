"""
What a character knows, and when (refactor doc 06 §6, v1).

An interview used to hand the character a journey summary built from every scene that
merely *named* them, and nothing told them where their knowledge stopped — so a character
would happily discuss a scene they were not in, or events after the point the author was
asking about. This module answers a narrower question: which scenes was this character
present for, up to a given point in the story, and what were they told there.

Presence comes from what the author has already recorded: point of view, attributed
dialogue, and their name in the prose. Once a story has been synced into Codex (doc 07 §3)
this reads the graph instead, which adds two things the direct computation cannot have:
the author's own "who is here" corrections, and facts a character was told offscreen. A
story with no graph yet falls back to computing it here, so nothing waits on a sync.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..models.character import Character
from ..models.codex import CodexEdge, CodexNode
from ..models.dialogue import DialogueBlock
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.structure import StructureNode
from .character_journey import get_nodes_up_to

#: Why we believe the character was in a scene, most authoritative first.
POV = "point of view"
SPEAKS = "speaks in the scene"
NAMED = "named in the prose"
#: Marks a scene the character was *not* in, included only because the author asked to
#: show them the whole manuscript (omniscient mode).
UNLIVED = "not present — shown to you"


@dataclass(frozen=True)
class ScenePresence:
    node_id: str
    title: str
    reasons: tuple[str, ...]
    summary: str | None = None


#: How much of the story a character may draw on.
#:   profile    — outside the story: themselves, not the plot
#:   present    — every scene they were present for, across the whole manuscript
#:   as_of      — the same, but stopping at one scene
#:   omniscient — the whole manuscript including scenes they were never in, which is a
#:                hypothetical the author is posing, not something the character lived
PROFILE_ONLY = "profile"
PRESENT = "present"
AS_OF = "as_of"
OMNISCIENT = "omniscient"


@dataclass
class KnowledgeScope:
    """The scenes a character was present for and what they learned, up to a point."""

    #: "profile" | "present" | "as_of" | "omniscient"
    mode: str = PRESENT
    as_of_node_id: str | None = None
    as_of_title: str | None = None
    scenes: list[ScenePresence] = field(default_factory=list)
    #: Reader-knowledge events this character is recorded as knowing.
    facts: list[dict] = field(default_factory=list)
    #: How many scenes exist up to the cutoff, present or not — the denominator that
    #: makes "3 of 18 scenes" honest.
    scenes_considered: int = 0


#: How a presence edge's basis reads in the prompt.
_BASIS_REASONS = {"pov": POV, "dialogue": SPEAKS, "mention": NAMED, "manual": "the author placed you here"}


def _scope_from_graph(
    character: Character, db: Session, scene_order: list[StructureNode], as_of_title: str | None, mode: str
) -> KnowledgeScope | None:
    """
    Build the scope from Codex edges, or return None when this story has no graph yet.

    The graph is the better answer because it carries what a bare re-computation cannot:
    scenes the author corrected by hand, and facts a character learned offscreen.
    """
    char_node = (
        db.query(CodexNode)
        .filter(
            CodexNode.story_id == character.story_id, CodexNode.kind == "character", CodexNode.ref_id == character.id
        )
        .one_or_none()
    )
    if not char_node:
        return None

    in_range = {n.id: n for n in scene_order}
    scene_nodes = {
        n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == character.story_id, CodexNode.kind == "scene")
    }
    order = {node.id: i for i, node in enumerate(scene_order)}

    present: list[ScenePresence] = []
    for edge in db.query(CodexEdge).filter(
        CodexEdge.story_id == character.story_id, CodexEdge.kind == "present_in", CodexEdge.src_id == char_node.id
    ):
        scene = scene_nodes.get(edge.dst_id)
        role = (edge.props or {}).get("role")
        if not scene or scene.ref_id not in in_range or role == "absent":
            continue
        if mode == OMNISCIENT:
            continue  # omniscient is every scene, handled below
        present.append(
            ScenePresence(
                node_id=scene.ref_id,
                title=scene.label,
                reasons=(_BASIS_REASONS.get((edge.props or {}).get("basis"), NAMED),),
                summary=scene.summary or None,
            )
        )

    if mode == OMNISCIENT:
        by_ref = {n.ref_id: n for n in scene_nodes.values()}
        present = [
            ScenePresence(
                node_id=node.id,
                title=node.title,
                reasons=(NAMED,),
                summary=(by_ref[node.id].summary or None) if node.id in by_ref else None,
            )
            for node in scene_order
        ]

    present.sort(key=lambda p: order.get(p.node_id, 0))

    facts = [
        {"subject": fact.label, "detail": fact.summary, "is_truth": True}
        for fact in (
            db.get(CodexNode, edge.dst_id)
            for edge in db.query(CodexEdge).filter(
                CodexEdge.story_id == character.story_id,
                CodexEdge.kind == "knows",
                CodexEdge.src_id == char_node.id,
            )
        )
        if fact
    ]
    return KnowledgeScope(
        as_of_title=as_of_title,
        scenes=present,
        facts=facts,
        scenes_considered=len(scene_order),
    )


def _leaf_scenes(nodes: list[StructureNode]) -> list[StructureNode]:
    """Scenes only: acts and chapters are containers, not places a character can be."""
    parent_ids = {n.parent_id for n in nodes if n.parent_id}
    return [n for n in nodes if n.id not in parent_ids]


def build_scope(
    character: Character,
    db: Session,
    as_of_node_id: str | None = None,
    mode: str = PRESENT,
) -> KnowledgeScope:
    """
    What this character may draw on, in one of four modes.

    `profile` is the deliberate empty case: an interview held outside the story, where the
    character is only their profile. It is not the same as having appeared in no scenes,
    and the prompt says so differently.

    `present` and `as_of` are the union of three signals the author has already given us —
    point of view, attributed dialogue, their name in the prose — with `as_of` stopping at
    a scene. Nothing here guesses at offscreen knowledge: if the author has not recorded
    it, the character does not know it, and the prompt says so out loud.

    `omniscient` hands over the whole manuscript, scenes they were never in included. That
    is not a claim about the character; it is the author asking a hypothetical, and the
    prompt frames it as one.
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

    as_of_title = None
    if as_of_node_id:
        cutoff = db.get(StructureNode, as_of_node_id)
        as_of_title = cutoff.title if cutoff else None

    # Prefer the graph: it carries the author's "who is here" corrections and facts a
    # character was told offscreen, neither of which can be recomputed from the prose.
    from_graph = _scope_from_graph(character, db, scenes, as_of_title, mode)
    if from_graph:
        from_graph.mode = mode if mode == OMNISCIENT else (AS_OF if as_of_node_id else PRESENT)
        from_graph.as_of_node_id = as_of_node_id
        return from_graph

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
        # Omniscient keeps the scenes they were absent from, labelled as such, so the
        # drawer and the prompt can both tell lived experience from what was shown.
        if not reasons and mode == OMNISCIENT:
            reasons.append(UNLIVED)
        if reasons:
            present.append(
                ScenePresence(
                    node_id=node.id,
                    title=node.title,
                    reasons=tuple(reasons),
                    summary=node.content_summary or None,
                )
            )

    return KnowledgeScope(
        mode=mode if mode == OMNISCIENT else (AS_OF if as_of_node_id else PRESENT),
        as_of_node_id=as_of_node_id,
        as_of_title=as_of_title,
        scenes=present,
        facts=_facts_known(character, {p.node_id for p in present}, db, mode),
        scenes_considered=len(scenes),
    )


def _facts_known(character: Character, present_node_ids: set[str], db: Session, mode: str = PRESENT) -> list[dict]:
    """
    Reader-knowledge events this character knows: the ones the author listed them on, plus
    what happened in scenes they narrate. Being in the room is not knowing — a clue planted
    for the reader stays the reader's.

    Omniscient is the exception, and deliberately so: the author is asking the character to
    look at what the *reader* knows.
    """
    events = db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == character.story_id).all()
    known = []
    for event in events:
        listed = character.id in (event.characters_who_know or [])
        in_their_scene = event.node_id in present_node_ids and event.knowledge_type == "character_learns"
        if mode == OMNISCIENT or listed or in_their_scene:
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

    if scope.mode == OMNISCIENT:
        heading = (
            "\n\nYour author is showing you the whole manuscript, including scenes you were "
            "not in. This is a hypothetical: you did not live the scenes marked as shown to "
            "you, and you would not know them inside the story."
        )
    else:
        heading = f"\n\nWhat you have been present for{f' (up to {scope.as_of_title})' if scope.as_of_title else ''}:"

    lines = [heading]
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

    if scope.mode == OMNISCIENT:
        lines.append(
            "\nAnswer as yourself about all of it — that is what your author is asking for. "
            "When you speak about something you did not live through, say so: 'I wasn't there, "
            "but if I had been…'. Never claim to remember what you were shown, and never "
            "invent events that are not above."
        )
    else:
        lines.append(
            "\nYou do not know anything outside these scenes"
            + (f", and nothing that happens after {scope.as_of_title}" if scope.as_of_title else "")
            + ". If the author asks about something you were not present for, say you were not "
            "there or do not know — do not reconstruct it, and do not pretend to remember. "
            "You may of course say what you would guess, as long as you name it as a guess."
        )
    return "\n".join(lines)
