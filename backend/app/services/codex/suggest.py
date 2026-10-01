"""
The suggestion pass: the one place a model writes into the Codex (doc 07 §8 step 6).

What it writes is always a proposal. Presence lands as an `llm` edge with no
`confirmed_at`; a fact lands as an `llm` node with an `established_in` edge to its scene.
Neither counts for anything — interviews, retrieval and the knowledge scope all filter
unconfirmed proposals out — until the author confirms it in the review queue.

Confirming does not bless the proposal in place. It writes the real authored row: a
`scene_presence` answer, or a `ReaderKnowledgeEvent`. So a confirmed suggestion lives in
the Lorebook where snapshots, exports and undo reach it, and the graph goes back to being
a view over the author's own tables (doc 07 §2).
"""

import logging
from dataclasses import dataclass, field

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...models.codex import CodexEdge, CodexNode
from ...models.structure import StructureNode
from ...models.user import User
from ..llm.gateway import AICallContext, ai_gateway
from ..llm.prompts.codex_suggest import build_codex_suggest_prompt
from ..text_utils import html_to_text

logger = logging.getLogger(__name__)

#: Below this, a proposal is noise the author has to read and reject. The pass is only
#: worth running if skimming its output is faster than doing the tagging by hand.
MIN_CONFIDENCE = 0.5

#: Prose shorter than this is a fragment, not a scene.
MIN_PROSE_CHARS = 200

#: How much of a scene goes to the model. Long enough for a whole scene in practice.
PROSE_LIMIT = 12000


class _PresentItem(BaseModel):
    name: str
    quote: str
    confidence: float = Field(ge=0.0, le=1.0)


class _FactItem(BaseModel):
    statement: str
    quote: str
    confidence: float = Field(ge=0.0, le=1.0)


class SuggestionResponse(BaseModel):
    # Required, not defaulted. The schema is the grammar Ollama decodes against, and a
    # schema with no required keys admits `{}` — which a model will take as the shortest
    # valid answer, reporting success having read nothing. Empty lists are a finding;
    # an empty object is not.
    present: list[_PresentItem]
    establishes: list[_FactItem]


@dataclass
class SuggestReport:
    scenes: int = 0
    presence: int = 0
    facts: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def _scene_nodes(story_id: str, db: Session) -> dict[str, CodexNode]:
    return {n.ref_id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind == "scene")}


def _existing_presence(story_id: str, scene_node_id: str, db: Session) -> set[str]:
    """Character node ids the graph already places in this scene, proposals included."""
    return {
        e.src_id
        for e in db.query(CodexEdge).filter(
            CodexEdge.story_id == story_id,
            CodexEdge.kind == "present_in",
            CodexEdge.dst_id == scene_node_id,
        )
        if (e.props or {}).get("role") != "mentioned"
    }


def _fact_labels(story_id: str, db: Session) -> list[str]:
    return [
        n.label for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind == "fact") if n.label
    ]


async def suggest_for_scene(
    node: StructureNode,
    db: Session,
    user: User,
    *,
    scene_nodes: dict[str, CodexNode],
    char_nodes: dict[str, CodexNode],
) -> SuggestReport:
    """Read one scene and record what it proposes. Returns what it wrote."""
    report = SuggestReport()
    scene_node = scene_nodes.get(node.id)
    prose = html_to_text(node.content or "")
    if not scene_node or len(prose) < MIN_PROSE_CHARS or not char_nodes:
        report.skipped = 1
        return report

    by_node_id = {n.id: n for n in char_nodes.values()}
    present_ids = _existing_presence(node.story_id, scene_node.id, db)
    prompt = build_codex_suggest_prompt(
        scene_title=node.title or "Untitled scene",
        prose=prose[:PROSE_LIMIT],
        cast=[n.label for n in char_nodes.values()],
        already_present=[by_node_id[i].label for i in present_ids if i in by_node_id],
        known_facts=_fact_labels(node.story_id, db),
    )
    result = await ai_gateway.generate_structured(
        response_model=SuggestionResponse,
        messages=[{"role": "user", "content": "Index this scene."}],
        feature_prompt=prompt,
        context=AICallContext(
            feature="codex-suggest",
            user_id=user.id,
            story_id=node.story_id,
            node_id=node.id,
            tags=["codex", "suggestion", "user-initiated"],
        ),
        db=db,
        user=user,
    )
    report.scenes = 1
    if not result.success:
        report.errors.append(f"{node.title}: the model's answer could not be read")
        return report

    parsed = SuggestionResponse.model_validate(result.data)
    by_name = {n.label.lower(): n for n in char_nodes.values()}
    for item in parsed.present:
        char_node = by_name.get(item.name.strip().lower())
        if not char_node or char_node.id in present_ids or item.confidence < MIN_CONFIDENCE or not item.quote:
            continue
        db.add(
            CodexEdge(
                story_id=node.story_id,
                src_id=char_node.id,
                dst_id=scene_node.id,
                kind="present_in",
                props={"basis": "inferred", "role": "participant", "quote": item.quote.strip()},
                source="llm",
                confidence=item.confidence,
            )
        )
        present_ids.add(char_node.id)
        report.presence += 1

    known = {label.lower() for label in _fact_labels(node.story_id, db)}
    for item in parsed.establishes:
        statement = item.statement.strip()
        if not statement or statement.lower() in known or item.confidence < MIN_CONFIDENCE or not item.quote:
            continue
        fact = CodexNode(
            story_id=node.story_id,
            kind="fact",
            ref_table="",
            ref_id=f"llm:{node.id}:{len(known)}",
            label=statement,
            summary=item.quote.strip(),
            props={"quote": item.quote.strip(), "confidence": item.confidence},
            source="llm",
        )
        db.add(fact)
        db.flush()
        db.add(
            CodexEdge(
                story_id=node.story_id,
                src_id=fact.id,
                dst_id=scene_node.id,
                kind="established_in",
                props={"quote": item.quote.strip()},
                source="llm",
                confidence=item.confidence,
            )
        )
        known.add(statement.lower())
        report.facts += 1

    db.commit()
    return report


async def suggest_for_story(
    story_id: str,
    db: Session,
    user: User,
    *,
    node_ids: list[str] | None = None,
    should_stop=None,
    on_progress=None,
) -> dict:
    """
    Walk the manuscript a scene at a time, proposing as it goes.

    Committing per scene is what makes it interruptible: stop it halfway and the review
    queue holds what it found so far, which is worth reviewing on its own.
    """
    scene_nodes = _scene_nodes(story_id, db)
    char_nodes = {
        n.ref_id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind == "character")
    }
    scenes = db.query(StructureNode).filter(StructureNode.story_id == story_id)
    if node_ids:
        scenes = scenes.filter(StructureNode.id.in_(node_ids))
    todo = [n for n in scenes.order_by(StructureNode.position).all() if n.id in scene_nodes]

    total = SuggestReport()
    for index, node in enumerate(todo):
        if should_stop is not None and should_stop():
            break
        one = await suggest_for_scene(node, db, user, scene_nodes=scene_nodes, char_nodes=char_nodes)
        total.scenes += one.scenes
        total.presence += one.presence
        total.facts += one.facts
        total.skipped += one.skipped
        total.errors.extend(one.errors)
        if on_progress is not None:
            on_progress(index + 1, len(todo))
    return {
        "scenes": total.scenes,
        "presence": total.presence,
        "facts": total.facts,
        "skipped": total.skipped,
        **({"errors": total.errors[:5]} if total.errors else {}),
    }
