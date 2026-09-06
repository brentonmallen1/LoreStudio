"""
Refreshing scene summaries in bulk.

Extracted from the batch endpoint so the same work can run as a job (doc 06 §8): the
endpoint held a request open for as long as the manuscript took, with nothing to watch and
no way to stop it. The logic did not change — it just got a caller that can be cancelled
and a place to report progress.
"""

import logging
import re
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.character_journey import CharacterJourneySummary
from ..models.structure import StructureNode
from ..models.user import User
from .llm.gateway import AICallContext, ai_gateway
from .llm.prompts.summaries import build_scene_summary_prompt

logger = logging.getLogger(__name__)

_THOUGHTS = re.compile(r"<\|channel>thought\n[\s\S]*?<channel\|>")


def leaf_scenes(story_id: str, db: Session, up_to_node_id: str | None = None) -> list[StructureNode]:
    """Scenes in reading order, optionally stopping at a node."""
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    children: dict[str, list[StructureNode]] = {}
    roots: list[StructureNode] = []
    for node in all_nodes:
        if node.parent_id:
            children.setdefault(node.parent_id, []).append(node)
        else:
            roots.append(node)

    def flatten(nodes: list[StructureNode]) -> list[StructureNode]:
        out: list[StructureNode] = []
        for node in sorted(nodes, key=lambda x: x.position):
            kids = children.get(node.id, [])
            out.extend(flatten(kids) if kids else [node])
        return out

    leaves = flatten(roots)
    if up_to_node_id:
        cutoff = next((i for i, n in enumerate(leaves) if n.id == up_to_node_id), None)
        if cutoff is not None:
            leaves = leaves[: cutoff + 1]
    return leaves


def _mark_journeys_stale(node_id: str, db: Session) -> None:
    """A rewritten scene summary makes any journey built from it out of date."""
    affected = db.query(CharacterJourneySummary).filter(CharacterJourneySummary.source_node_ids.contains(node_id)).all()
    for journey in affected:
        journey.is_stale = True
    if affected:
        db.commit()


async def refresh_scene_summaries(
    story_id: str,
    db: Session,
    user: User,
    *,
    force_refresh: bool = False,
    up_to_node_id: str | None = None,
    on_progress: Callable[[int, int], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> dict:
    """
    Summarise every scene that needs it, reporting progress and stopping when asked.

    Returns counts; also writes the run to the activity log so it shows up in Story Health
    the same way it always did.
    """
    leaves = leaf_scenes(story_id, db, up_to_node_id)
    todo = [
        n
        for n in leaves
        if n.content and n.content.strip() and (force_refresh or not n.content_summary or n.summary_stale)
    ]
    summarized = failed = 0
    stopped = False

    for index, node in enumerate(todo):
        if should_stop and should_stop():
            stopped = True
            break
        try:
            tokens: list[str] = []
            async for token in ai_gateway.stream(
                messages=[{"role": "user", "content": f"Scene: {node.title}\n\n{node.content}"}],
                feature_prompt=build_scene_summary_prompt(node.title, node.content),
                context=AICallContext(
                    feature="scene-summary-batch",
                    user_id=user.id,
                    story_id=story_id,
                    node_id=node.id,
                    tags=["manuscript", "summarization", "batch"],
                ),
                db=db,
                user=user,
            ):
                tokens.append(token)
            summary = _THOUGHTS.sub("", "".join(tokens)).strip()
            if summary:
                node.content_summary = summary
                node.summary_stale = False
                node.summary_updated_at = datetime.now(UTC)
                db.commit()
                _mark_journeys_stale(node.id, db)
                summarized += 1
            else:
                failed += 1
        except Exception:
            logger.exception("scene summary failed for node %s", node.id)
            failed += 1
        if on_progress:
            on_progress(index + 1, len(todo))

    counts = {
        "total_scenes": len(leaves),
        "summarized_count": summarized,
        "skipped_count": len(leaves) - len(todo),
        "failed_count": failed,
        "stopped": stopped,
    }
    db.add(
        ActivityLog(
            user_id=user.id,
            story_id=story_id,
            event_type="analysis_run",
            category="health",
            description=(
                f"Scene summaries {'stopped after' if stopped else 'generated:'} {summarized} summarized, "
                f"{counts['skipped_count']} skipped, {failed} failed"
            ),
            metadata_={"feature": "scene-summary-batch", **counts},
        )
    )
    db.commit()
    return counts
