"""
The context assembler: one place that decides what an AI feature is told (doc 07 §5).

Before this, every router built its own context and `llm_preview` built a second version
of the same thing so the author could inspect it. Two implementations of one answer drift,
and the one the author reads is the one that is not sent. Here the blocks the transparency
view shows are *derived from* the packet the model receives, in the same call — so the
preview cannot describe context that was never assembled.

`Block` carries provenance: what it is, whether it made it in, what it cost, and why it
was included. For anything the graph or the index turned up, "why" is a real answer —
"Mara was present in Ch. 7" — not a category name.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...models.character import Character, CharacterRelationship
from ...models.codex import CodexChunk, CodexEdge, CodexNode, is_settled
from ...models.interview import CharacterInterview
from ...models.location import Location
from ...models.plot_thread import PlotThread, PlotThreadAppearance
from ...models.story import Story
from ...models.structure import StructureNode
from ...models.twist import Twist
from ...models.user import User
from ...schemas.mentions import MentionedRef
from ..character_journey import get_cached_journey
from ..character_knowledge import build_scope, describe_scope
from ..llm.prompts.interviews import build_character_interview_system_prompt
from ..llm.prompts.panel import build_panel_character_prompt
from ..prose_html import paragraphs
from ..prose_syntax import Known, Lexicon, find_mentions
from ..thread_roles import role_label
from .chunker import estimate_tokens
from .embeddings import Hit, embed_base_url_for, embed_model_for, embed_texts, search
from .mentions import render_mentions, resolve_mentions, without


class ContextOptions(BaseModel):
    """Controls which context sections are included in the LLM prompt."""

    include_characters: bool = True
    include_threads: bool = True
    include_settings: bool = True
    include_siblings: bool = True
    include_twists: bool = True


# How many characters of prose to include in context (keep tokens reasonable)
PROSE_CONTEXT_LIMIT = 2000


logger = logging.getLogger(__name__)

#: Node ids the frontend sends when there is no scene — story-level and global chat.
VIRTUAL_NODE_IDS = {"__global__", "__story__"}


def _extract_mentions(content: str, characters: list, places: list) -> tuple[set[str], set[str]]:
    """The characters and places the scene mentions, by name, other name or (a character) a
    short form only they go by: (character names, place names). Read by the grammar the
    editor shares (services/prose_syntax), so "@Eleanor Vance" is Eleanor Vance, not "Eleanor"."""
    lex = Lexicon(
        [Known("character", c.name, tuple(c.aliases or ())) for c in characters if c.name]
        + [Known("place", p.name, tuple(p.aliases or ())) for p in places if p.name]
    )
    found = [(m.kind, m.name) for para in paragraphs(content or "") for m in find_mentions(para.text, lex) if m.name]
    return {n for k, n in found if k == "character"}, {n for k, n in found if k == "place"}


VIRTUAL_NODE_IDS = {"__global__", "__story__"}


def build_packet(  # noqa: C901, PLR0912, PLR0915
    story: Story,
    node: StructureNode | None,
    db: Session,
    context_options: ContextOptions | None = None,
    mentioned_refs: list[MentionedRef] | None = None,
) -> dict:
    """
    The context packet itself: everything the scene assistant is told, as a dict.

    `mentioned_refs` are what the author @mentioned in the composer (doc 11 P6). They are
    added under `mentioned` after the automatic selection, minus anything it already
    covers; nothing else in the packet changes.
    """

    # ── Lorebook ──
    # Resolve POV character name if set
    pov_char_name: str | None = None
    if story.pov_character_id:
        pov_char = db.get(Character, story.pov_character_id)
        if pov_char:
            pov_char_name = pov_char.name

    lorebook = {
        "title": story.title,
        "genre": story.genre or None,
        "tone": story.tone or None,
        "themes": story.themes or [],
        "central_conflict": story.central_conflict or None,
        "narrative_intent": story.narrative_intent or story.intent or None,
        "logline": story.logline or None,
        "premise": story.premise or None,
        "narrative_perspective": story.narrative_perspective or None,
        "pov_character": pov_char_name,
        "unresolved_goals": [g["text"] for g in (story.goals or []) if not g.get("completed")],
    }

    # ── Active scene (None for story-level / global assistant) ──
    if node is not None:
        prose_preview = (node.content or "")[:PROSE_CONTEXT_LIMIT]
        if len(node.content or "") > PROSE_CONTEXT_LIMIT:
            prose_preview += "…"
        scene = {
            "title": node.title,
            "level_type": node.level_type,
            "synopsis": node.synopsis or None,
            "purpose": node.purpose or None,
            "entry_state": node.entry_state or None,
            "exit_state": node.exit_state or None,
            "key_events": node.key_events or None,
            "word_count": node.word_count,
            "status": node.status,
            "prose_preview": prose_preview or None,
        }
        node_content = node.content or ""
        node_id_for_threads = node.id
        node_parent_id = node.parent_id
    else:
        scene = None
        node_content = ""
        node_id_for_threads = None
        node_parent_id = None

    # ── Resolve context option flags (default all True) ──
    opts = context_options or ContextOptions()

    # ── Characters mentioned in prose ──
    all_chars = db.query(Character).filter(Character.story_id == story.id).all()
    all_places = db.query(Location).filter(Location.story_id == story.id).all()
    char_names_mentioned, place_names_mentioned = _extract_mentions(node_content, all_chars, all_places)
    # Always include light summary of all characters for context
    all_char_summaries = [
        {"name": c.name, "role": c.role, "motivation": c.motivation[:100] if c.motivation else None} for c in all_chars
    ]

    mentioned_char_profiles = []
    if opts.include_characters:
        mentioned_chars = [c for c in all_chars if c.name in char_names_mentioned]
        for c in mentioned_chars:
            profile: dict = {"name": c.name, "role": c.role}
            if c.personality:
                profile["personality"] = c.personality
            if c.motivation:
                profile["motivation"] = c.motivation
            if c.background:
                profile["background"] = c.background[:300]
            if c.arc_notes:
                profile["arc_notes"] = c.arc_notes
            for field in ("flaws", "quirks", "speech_patterns"):
                if getattr(c, field):
                    profile[field] = getattr(c, field)
            if c.narrative_intent and not c.narrative_intent_hidden:
                profile["narrative_intent"] = c.narrative_intent
            if c.arc_milestones:
                profile["arc_milestones_pending"] = [m["text"] for m in c.arc_milestones if not m.get("completed")]
            mentioned_char_profiles.append(profile)

    # ── Settings mentioned ──
    mentioned_settings = []
    if opts.include_settings:
        # Places in the Lorebook (the old settings table no longer holds the story's places).
        mentioned_settings = [
            {
                "name": p.name,
                "description": p.description[:200] if p.description else None,
                "atmosphere": p.atmosphere[:200] if p.atmosphere else None,
            }
            for p in all_places
            if p.name in place_names_mentioned
        ]

    # ── Plot threads touching this scene ──
    threads_in_scene: list = []
    all_open_threads: list = []
    if opts.include_threads:
        if node_id_for_threads:
            thread_appearances = (
                db.query(PlotThreadAppearance).filter(PlotThreadAppearance.node_id == node_id_for_threads).all()
            )
            active_thread_ids = {a.thread_id for a in thread_appearances}
            active_threads = (
                db.query(PlotThread).filter(PlotThread.id.in_(active_thread_ids)).all() if active_thread_ids else []
            )
            # What this scene does to each thread, and the author's note on it (doc 18 C8).
            here = {a.thread_id: a for a in thread_appearances}
            threads_in_scene = [
                {
                    "name": t.name,
                    "status": t.status,
                    "description": t.description[:150] if t.description else None,
                    "here": role_label(here[t.id].role),
                    "note": here[t.id].note or None,
                }
                for t in active_threads
            ]
        all_open_threads = [
            {"name": t.name, "status": t.status}
            for t in db.query(PlotThread).filter(PlotThread.story_id == story.id).all()
            if t.status in ("planned", "open")
        ]

    # ── Twists planted or revealed in this scene (doc 18 C8) ──
    twists_in_scene: list = []
    if opts.include_twists and node_id_for_threads:
        for tw in db.query(Twist).filter(Twist.story_id == story.id).all():
            clues = [c for c in tw.clues if c.node_id == node_id_for_threads]
            revealed = tw.revealed_at_node_id == node_id_for_threads
            if not (clues or revealed):
                continue
            twists_in_scene.append(
                {
                    "name": tw.name,
                    "here": "revealed in this scene" if revealed else "clues planted in this scene",
                    "the_truth": tw.the_truth or None,
                    "the_misdirection": tw.the_misdirection or None,
                    "clues_here": [
                        {"text": c.text, "points_to": c.points_to, "quote": c.quote or None} for c in clues if c.text
                    ],
                }
            )

    # ── Sibling context (adjacent scenes) ──
    sibling_context: list = []
    if opts.include_siblings and node is not None:
        siblings = (
            db.query(StructureNode)
            .filter(
                StructureNode.story_id == story.id,
                StructureNode.parent_id == node_parent_id,
                StructureNode.id != node.id,
            )
            .order_by(StructureNode.position)
            .all()
        )
        sibling_context = [
            {"title": s.title, "synopsis": s.synopsis[:120] if s.synopsis else None, "position": s.position}
            for s in siblings[:6]
        ]

    mentioned = without(
        resolve_mentions(story.id, mentioned_refs, db),
        names_by_kind={
            "character": {c["name"] for c in mentioned_char_profiles},
            "thread": {t["name"] for t in threads_in_scene},
        },
        node_id=node.id if node else None,
    )

    return {
        "story": lorebook,
        "scene": scene,
        "characters_in_scene": mentioned_char_profiles,
        "all_characters": all_char_summaries,
        "settings_in_scene": mentioned_settings,
        "threads_in_scene": threads_in_scene,
        "open_threads": all_open_threads,
        "twists_in_scene": twists_in_scene,
        "sibling_scenes": sibling_context,
        "mentioned": mentioned,
    }


@dataclass
class Block:
    """One piece of assembled context, and the reason it is there."""

    key: str  # stable id, e.g. "scene.synopsis" — what the UI groups on
    label: str  # human readable, for the transparency view
    included: bool
    tokens: int = 0
    #: Why this is here, in the author's terms. Empty for context that is simply always
    #: sent; filled in for anything the graph or the index chose.
    why: str = ""
    node_id: str | None = None
    #: The passage this block stands for, when it came from the semantic index.
    chunk_id: str | None = None
    score: float | None = None


@dataclass
class AssembledContext:
    """What was assembled, and an account of it the author can read."""

    packet: dict
    #: The finished system prompt, for features that assemble one rather than a packet.
    prompt: str = ""
    blocks: list[Block] = field(default_factory=list)
    #: Passages the semantic index contributed, in rank order.
    retrieved: list[Block] = field(default_factory=list)
    budget: int = 0

    @property
    def tokens(self) -> int:
        return sum(b.tokens for b in self.blocks + self.retrieved if b.included)


def _tokens(value: Any) -> int:
    """Rough cost of a packet section, using the same heuristic as everything else."""
    if value is None:
        return 0
    if isinstance(value, str):
        return estimate_tokens(value)
    if isinstance(value, dict):
        return sum(_tokens(v) for v in value.values())
    if isinstance(value, list):
        return sum(_tokens(v) for v in value)
    return 0


def _blocks_for(packet: dict) -> list[Block]:
    """
    Describe a packet, from the packet.

    Every line here reads the assembled dict rather than the rows it came from. That is
    the whole trick: a section that was skipped cannot be reported as included, because
    there is nothing in the packet to report.
    """
    story = packet.get("story") or {}
    scene = packet.get("scene") or {}
    blocks = [
        Block("story.title", f"Story: {story.get('title', '')}", True, _tokens(story.get("title"))),
        Block(
            "story.intent", "Story intent", bool(story.get("narrative_intent")), _tokens(story.get("narrative_intent"))
        ),
        Block(
            "story.premise",
            "Logline and premise",
            bool(story.get("logline") or story.get("premise")),
            _tokens(story.get("logline")) + _tokens(story.get("premise")),
        ),
        Block(
            "story.themes",
            f"Themes ({len(story.get('themes') or [])})",
            bool(story.get("themes")),
            _tokens(story.get("themes")),
        ),
        Block(
            "story.goals",
            f"Unresolved goals ({len(story.get('unresolved_goals') or [])})",
            bool(story.get("unresolved_goals")),
            _tokens(story.get("unresolved_goals")),
        ),
    ]
    if scene:
        blocks += [
            Block("scene.metadata", f"Scene: {scene.get('title', '')}", True, _tokens(scene.get("title"))),
            Block("scene.synopsis", "Scene synopsis", bool(scene.get("synopsis")), _tokens(scene.get("synopsis"))),
            Block("scene.purpose", "Scene purpose", bool(scene.get("purpose")), _tokens(scene.get("purpose"))),
            Block(
                "scene.entry_exit",
                "Entry/exit state",
                bool(scene.get("entry_state") or scene.get("exit_state")),
                _tokens(scene.get("entry_state")) + _tokens(scene.get("exit_state")),
            ),
            Block(
                "scene.prose",
                "Scene prose (truncated)",
                bool(scene.get("prose_preview")),
                _tokens(scene.get("prose_preview")),
                why=f"the first {PROSE_CONTEXT_LIMIT} characters",
            ),
        ]
    for key, label, why in (
        ("characters_in_scene", "Characters in scene", "@mentioned in the prose"),
        ("settings_in_scene", "Settings", "[[mentioned]] in the prose"),
        ("threads_in_scene", "Plot threads", "the thread appears in this scene"),
        ("twists_in_scene", "Twists", "a clue is planted or the twist revealed in this scene"),
        ("sibling_scenes", "Neighbouring scenes", "adjacent in the manuscript"),
        ("all_characters", "Cast summary", ""),
        ("open_threads", "Open threads", ""),
        ("mentioned", "Also in mind", "you @mentioned them"),
    ):
        items = packet.get(key) or []
        blocks.append(Block(key, f"{label} ({len(items)})", bool(items), _tokens(items), why=why if items else ""))
    return blocks


def assemble_scene(
    story: Story,
    node: StructureNode | None,
    db: Session,
    context_options: ContextOptions | None = None,
    budget: int = 0,
    mentioned_refs: list[MentionedRef] | None = None,
) -> AssembledContext:
    """The packet and its account of itself, from one pass over the story."""
    packet = build_packet(story, node, db, context_options, mentioned_refs)
    return AssembledContext(packet=packet, blocks=_blocks_for(packet), budget=budget)


#: What each edge kind means, said the way an author would say it. The transparency view
#: shows these, so "present_in" is never what the author reads.
EDGE_PHRASES = {
    "present_in": "present in",
    "speaks_in": "speaks in",
    "pov": "the point of view of",
    "at": "set in",
    "follows": "next to",
    "links": "linked to",
    "advances": "advances",
    "rel": "connected to",
    "knows": "known to",
    "revealed_in": "revealed in",
    "clue_in": "hinted at in",
    "established_in": "established in",
}

#: Which edges a feature follows out from its seeds (doc 07 §4). An interview walks who
#: was where and what they know; a continuity check walks the manuscript's own structure.
EDGE_KINDS_BY_FEATURE: dict[str, tuple[str, ...]] = {
    "interview": ("present_in", "knows", "rel"),
    "panel-interview": ("present_in", "knows", "rel"),
    "scene-chat": ("present_in", "at", "advances", "follows"),
    "what-if": ("present_in", "knows", "advances", "links"),
    "continuity-check": ("links", "advances", "follows", "established_in"),
}

DEFAULT_EDGE_KINDS = ("present_in", "at", "advances")

#: How far a walk goes. One hop is "what touches this scene"; two starts pulling in the
#: whole story, which is what the vector search is for.
DEFAULT_HOPS = 1

#: Why an interview's scope is what it is, said the way the picker says it.
SCOPE_REASONS = {
    "profile": "no story context — themselves, not the plot",
    "present": "every scene they were present for",
    "as_of": "every scene they were present for, up to this point",
    "omniscient": "the whole manuscript, as a hypothetical",
}


def edge_kinds_for(feature_id: str) -> tuple[str, ...]:
    return EDGE_KINDS_BY_FEATURE.get(feature_id, DEFAULT_EDGE_KINDS)


def walk(
    db: Session,
    story_id: str,
    seed_ref_ids: list[str],
    *,
    kinds: tuple[str, ...] = DEFAULT_EDGE_KINDS,
    hops: int = DEFAULT_HOPS,
) -> dict[str, str]:
    """
    Expand from seed rows along typed edges, returning node id → why it was reached.

    Edges are followed in both directions: from a scene you want the characters in it, and
    from a character you want the scenes they were in, and those are the same edge.
    """
    nodes = {n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id)}
    by_ref = {n.ref_id: n for n in nodes.values()}
    frontier = {by_ref[ref].id for ref in seed_ref_ids if ref in by_ref}
    reached: dict[str, str] = {node_id: "you are here" for node_id in frontier}
    if not frontier:
        return reached

    edges = [
        e
        for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.kind.in_(kinds))
        if is_settled(e)
    ]
    for _ in range(max(hops, 0)):
        next_frontier: set[str] = set()
        for edge in edges:
            for near, far in ((edge.src_id, edge.dst_id), (edge.dst_id, edge.src_id)):
                if near not in frontier or far in reached or far not in nodes:
                    continue
                phrase = EDGE_PHRASES.get(edge.kind, edge.kind)
                reached[far] = f"{phrase} {nodes[near].label}".strip()
                next_frontier.add(far)
        if not next_frontier:
            break
        frontier = next_frontier
    return reached


def _hit_block(hit: Hit, why: str, label: str) -> Block:
    # Unique per passage: the transparency view keys on this, and two passages from the
    # same scene are two entries, not one.
    return Block(
        key=f"retrieved.{hit.chunk_id}",
        label=label,
        included=True,
        tokens=hit.token_count,
        why=why,
        node_id=hit.node_id,
        chunk_id=hit.chunk_id,
        score=round(hit.score, 4),
    )


def retrieve_with_vector(
    db: Session,
    story_id: str,
    query: list[float],
    *,
    seed_ref_ids: list[str],
    kinds: tuple[str, ...] = DEFAULT_EDGE_KINDS,
    hops: int = DEFAULT_HOPS,
    limit: int = 8,
    model: str,
    whole_story: bool = False,
    restrict_ref_ids: list[str] | None = None,
    why: str = "",
) -> list[Block]:
    """
    Rank passages from the nodes the graph reached, keeping the reason with each one.

    `restrict_ref_ids` replaces the walk with an exact set, for callers that have already
    worked out what may be seen — an interview's scope is a bound, not a starting point,
    and a walk from it could reach a scene the character was deliberately kept out of.

    `whole_story=True` drops the restriction, for open story chat where the question does
    not start anywhere in particular. Everything else searches only what the walk found:
    retrieval ranks what the graph already decided was relevant.
    """
    if restrict_ref_ids is not None:
        by_ref = {
            n.ref_id: n.id
            for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.ref_id.in_(restrict_ref_ids))
        }
        reached = dict.fromkeys(by_ref.values(), why or "you were there")
    else:
        reached = walk(db, story_id, seed_ref_ids, kinds=kinds, hops=hops)
    hits = search(
        db,
        story_id,
        query,
        node_ids=None if whole_story else list(reached),
        limit=limit,
        model=model,
    )
    labels = {n.id: n.label for n in db.query(CodexNode).filter(CodexNode.id.in_([h.node_id for h in hits]))}
    return [
        _hit_block(hit, reached.get(hit.node_id, "found by meaning"), labels.get(hit.node_id, "Passage"))
        for hit in hits
    ]


async def retrieve_for(
    db: Session,
    story_id: str,
    question: str,
    *,
    feature: str,
    seed_ref_ids: list[str],
    user: User | None = None,
    whole_story: bool = False,
    limit: int = 6,
) -> list[Block]:
    """
    Passages from the Codex index relevant to what the author just asked.

    Every failure here is silent and returns nothing: no index yet, no embedding model
    pulled, Ollama not running. Retrieval makes an answer better informed — it is not
    what makes the feature work, and a chat that refuses to open because a background
    index is missing would be a worse product than one that answers with less.
    """
    if not question.strip():
        return []
    model = embed_model_for(user)
    try:
        vectors = await embed_texts([question], model=model, base_url=embed_base_url_for(user))
    except Exception as exc:
        logger.info("Codex retrieval skipped (%s)", exc)
        return []
    if not vectors:
        return []
    return retrieve_with_vector(
        db,
        story_id,
        vectors[0],
        seed_ref_ids=seed_ref_ids,
        kinds=edge_kinds_for(feature),
        limit=limit,
        model=model,
        whole_story=whole_story,
    )


def attach_passages(packet: dict, blocks: list[Block], db: Session) -> dict:
    """
    Put retrieved passages in the packet, each with the reason it was retrieved.

    The reason travels into the prompt, not just into the transparency view: a model told
    *why* a passage is here treats it as evidence about the story rather than as more
    prose to imitate.
    """
    if not blocks:
        return packet
    ids = [b.chunk_id for b in blocks if b.chunk_id]
    texts = {c.id: c.text for c in db.query(CodexChunk).filter(CodexChunk.id.in_(ids))}
    packet["retrieved_passages"] = [
        {"label": b.label, "why": b.why, "text": texts[b.chunk_id]}
        for b in blocks
        if b.chunk_id and texts.get(b.chunk_id)
    ]
    return packet


def _prior_interview_notes(character_id: str, interview_id: str, db: Session) -> str | None:
    """The last thing this character said in a different session, for continuity."""
    prior = (
        db.query(CharacterInterview)
        .filter(
            CharacterInterview.character_id == character_id,
            CharacterInterview.id != interview_id,
            CharacterInterview.interview_notes.isnot(None),
        )
        .order_by(CharacterInterview.updated_at.desc())
        .first()
    )
    return prior.interview_notes if prior and prior.interview_notes else None


async def _remembered_passages(
    character: Character,
    scope,
    question: str,
    db: Session,
    user: User | None,
) -> list[Block]:
    """
    Prose from the scenes this character was actually present for.

    The restriction is the scope itself, not a walk from it: the scope is already the
    answer to "what may this character draw on", and expanding from it could reach a scene
    they were deliberately kept out of. Profile-only interviews have no scenes, so they
    get nothing — which is the point of that mode.
    """
    if not question.strip() or not scope.scenes:
        return []
    model = embed_model_for(user)
    try:
        vectors = await embed_texts([question], model=model, base_url=embed_base_url_for(user))
    except Exception as exc:
        logger.info("Interview retrieval skipped (%s)", exc)
        return []
    if not vectors:
        return []
    return retrieve_with_vector(
        db,
        character.story_id,
        vectors[0],
        seed_ref_ids=[],
        restrict_ref_ids=[s.node_id for s in scope.scenes],
        limit=4,
        model=model,
        why="you were there",
    )


def _passage_lines(blocks: list[Block], db: Session) -> list[str]:
    """The remembered passages, framed as narration rather than as the character's words."""
    if not blocks:
        return []
    ids = [b.chunk_id for b in blocks if b.chunk_id]
    texts = {c.id: c.text for c in db.query(CodexChunk).filter(CodexChunk.id.in_(ids))}
    lines = [
        "\n\nThe narration of scenes you were present for, for your memory of what happened. "
        "These are the author's words about you, not yours: draw on what they describe, and "
        "never quote or paraphrase them back."
    ]
    for block in blocks:
        text = texts.get(block.chunk_id or "")
        if text:
            lines.append(f"\n[{block.label}]\n{text}")
    return lines


async def assemble_interview(
    interview: CharacterInterview,
    character: Character,
    db: Session,
    *,
    journey_summary: str | None = None,
    question: str = "",
    user: User | None = None,
    mentioned_refs: list[MentionedRef] | None = None,
) -> AssembledContext:
    """
    Everything an interview tells the character, and an account of it.

    The preview used to build this prompt from the character alone — no journey, no prior
    session, no knowledge bound — so the author inspected a persona that knew nothing
    about the story while the real call sent one that knew what it had lived through.

    `journey_summary` is passed in rather than generated: the caller that is already
    making an AI call may generate one, but inspecting a prompt must never cost a
    generation, so the preview gets whatever is cached and nothing more.
    """
    if journey_summary is None and interview.context_node_id:
        cached = get_cached_journey(character.id, interview.context_node_id, db)
        journey_summary = cached.summary if cached and cached.summary else None
    previous = _prior_interview_notes(character.id, interview.id, db)
    scope = build_scope(character, db, interview.context_node_id, interview.knowledge_scope)

    passages = await _remembered_passages(character, scope, question, db, user)
    prompt = build_character_interview_system_prompt(
        character, journey_summary, previous, describe_scope(character, scope) + "".join(_passage_lines(passages, db))
    )
    if interview.compacted_summary:
        prompt = (
            f"{prompt}\n\n"
            f"--- Earlier conversation summary (before history was compacted) ---\n"
            f"{interview.compacted_summary}\n"
            f"--- End of earlier summary ---"
        )
    mentioned = without(
        resolve_mentions(character.story_id, mentioned_refs, db), names_by_kind={"character": {character.name}}
    )
    prompt += render_mentions(mentioned)

    messages = len(interview.messages) if interview.messages else 0
    blocks = [
        Block("character.profile", f"{character.name}'s profile", True, estimate_tokens(prompt)),
        Block(
            "interview.scope",
            f"Scenes they were present for ({len(scope.scenes)} of {scope.scenes_considered})",
            bool(scope.scenes),
            why=SCOPE_REASONS.get(scope.mode, ""),
        ),
        Block("interview.facts", f"Facts they know ({len(scope.facts)})", bool(scope.facts)),
        Block("interview.journey", "Journey summary", bool(journey_summary), estimate_tokens(journey_summary or "")),
        Block("interview.previous", "Notes from an earlier session", bool(previous), estimate_tokens(previous or "")),
        Block("interview.compacted", "Compacted earlier conversation", bool(interview.compacted_summary)),
        Block("interview.history", f"Prior messages ({messages})", messages > 0),
        _mentioned_block(mentioned),
    ]
    return AssembledContext(packet={}, blocks=blocks, retrieved=passages, prompt=prompt)


def _mentioned_block(mentioned: list[dict]) -> Block:
    return Block(
        "mentioned",
        f"Also in mind ({len(mentioned)})",
        bool(mentioned),
        _tokens(mentioned),
        why="you @mentioned them" if mentioned else "",
    )


def assemble_panel_member(
    speaker: Character,
    others: list[Character],
    db: Session,
    *,
    response_length: str | None = None,
    mentioned_refs: list[MentionedRef] | None = None,
) -> AssembledContext:
    """
    One member of a panel: their persona, the room around them, and what they know.

    A panel is not one prompt — each member is asked separately — so this assembles one
    speaker's, and the preview shows the first speaker's as the shape every member gets.
    The knowledge bound is the same one an interview uses: a character in a group answers
    from what they lived through, not from what the room collectively knows.
    """
    ids = [c.id for c in [speaker, *others]]
    relationships = (
        db.query(CharacterRelationship)
        .filter(CharacterRelationship.character_id.in_(ids) | CharacterRelationship.related_character_id.in_(ids))
        .all()
    )
    scope = build_scope(speaker, db)
    prompt = build_panel_character_prompt(
        character=speaker,
        other_characters=others,
        relationships=relationships,
        response_length=response_length,
        knowledge_block=describe_scope(speaker, scope),
    )
    mentioned = without(
        resolve_mentions(speaker.story_id, mentioned_refs, db),
        names_by_kind={"character": {c.name for c in [speaker, *others]}},
    )
    prompt += render_mentions(mentioned)
    blocks = [
        Block("character.profile", f"{speaker.name}'s profile", True, estimate_tokens(prompt)),
        Block("panel.others", f"Others in the room ({len(others)})", bool(others)),
        Block("panel.relationships", f"Relationships between them ({len(relationships)})", bool(relationships)),
        Block(
            "interview.scope",
            f"Scenes they were present for ({len(scope.scenes)} of {scope.scenes_considered})",
            bool(scope.scenes),
            why=SCOPE_REASONS.get(scope.mode, ""),
        ),
        Block("interview.facts", f"Facts they know ({len(scope.facts)})", bool(scope.facts)),
        _mentioned_block(mentioned),
    ]
    return AssembledContext(packet={}, blocks=blocks, prompt=prompt)
