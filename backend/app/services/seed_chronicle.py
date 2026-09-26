"""
Chronicle history for "The Last Lighthouse": two jobs, so a new install can open one.

A fresh database had an empty Chronicle, and the thing it exists to show — a job you can
open to see what it asked the model and what came back — could only be seen after
running one. These rows are what an actual run leaves: a summary pass over the first
three scenes that finished, and a Codex suggestion pass that failed because Ollama was
not running. The prompts are built by the same function the real pass uses.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog
from ..models.ai_call import AICallPayload
from ..models.ai_job import AIJob
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from .codex.suggest import PROSE_LIMIT
from .llm.prompts.codex_suggest import build_codex_suggest_prompt
from .llm.prompts.summaries import build_scene_summary_prompt
from .text_utils import html_to_text

MODEL = "gemma4"
OPTIONS = {"temperature": 1.0, "top_p": 0.95, "top_k": 64, "num_ctx": 8192, "think": False}

#: What the model said about each of the first three scenes, in reading order.
SUMMARIES = [
    "Eleanor logs the falling barometer — 1012, 1008, 1003 — in the language her father taught "
    "her, then climbs to the lamp room as the storm comes in. The sea goes strangely still, and "
    "in the last light she sees a small boat making for the island where no boat should be.",
    "The knock comes at quarter past nine. Eleanor has already decided not to open the door, "
    "and opens it anyway: a grey-haired woman of about fifty in a soaked canvas jacket, calmer "
    "than the weather allows. Eleanor lets her in against her own judgement, on conditions.",
    "The Visitor asks to see the lighthouse logs, twelve cloth-bound volumes in the watch-room "
    "cabinet, half of them in Thomas Vance's hand. She says she wants only shipping and storm "
    "records. Eleanor hesitates over what the logs mean to her, then hands them over.",
]


def _call(
    db: Session,
    *,
    user: User,
    story: Story,
    job: AIJob,
    at: datetime,
    feature: str,
    system_prompt: str,
    user_message: str,
    response: str,
    status: str = "ok",
    error: str | None = None,
    node_id: str | None = None,
    tokens: tuple[int, int] | None = None,
    latency_ms: int = 0,
) -> None:
    log = ActivityLog(
        user_id=user.id,
        story_id=story.id,
        event_type=f"ai_{feature.replace('-', '_')}",
        category="ai",
        description=user_message[:80].replace("\n", " ").strip() + "…",
        created_at=at,
        metadata_={
            "model": MODEL,
            "tokens_in": tokens[0] if tokens else None,
            "tokens_out": tokens[1] if tokens else None,
            "latency_ms": latency_ms,
            "feature": feature,
            "tags": ["manuscript", "summarization", "batch"] if node_id else ["codex"],
            "node_id": node_id,
            "status": status,
            "error": error,
            "prompt": user_message[:300],
            "response": response[:300],
            "truncated": len(response) > 300,
            "temperature": OPTIONS["temperature"],
            "num_ctx": OPTIONS["num_ctx"],
            "thinking_enabled": False,
            "job_id": job.id,
        },
    )
    db.add(log)
    db.flush()
    db.add(
        AICallPayload(
            activity_log_id=log.id,
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            raw_response=response,
            options=OPTIONS,
            context_sources=[],
            error=error,
            created_at=at,
        )
    )


def seed_lighthouse_chronicle(
    db: Session, *, user: User, story: Story, scenes: list[StructureNode], cast: list[str]
) -> None:
    """Record a finished summary job over `scenes[:3]` and a failed Codex pass."""
    now = datetime.now(UTC).replace(tzinfo=None)

    # Yesterday: summaries for the first three scenes. The other scenes were empty or
    # already current, which is what "skipped" counts.
    start = now - timedelta(days=1, hours=2)
    summarised = scenes[:3]
    summary_job = AIJob(
        user_id=user.id,
        story_id=story.id,
        kind="scene-summaries",
        label=f"Scene summaries — {story.title}",
        status="done",
        params={"force_refresh": False},
        progress=len(summarised),
        total=len(summarised),
        result={
            "total_scenes": len(scenes),
            "summarized_count": len(summarised),
            "skipped_count": len(scenes) - len(summarised),
            "failed_count": 0,
            "stopped": False,
        },
        created_at=start,
        started_at=start + timedelta(seconds=1),
        finished_at=start + timedelta(seconds=11),
    )
    db.add(summary_job)
    db.flush()

    for i, (node, summary) in enumerate(zip(summarised, SUMMARIES, strict=True)):
        at = start + timedelta(seconds=2 + i * 3)
        prose = node.content or ""  # the real pass sends the HTML as stored
        _call(
            db,
            user=user,
            story=story,
            job=summary_job,
            at=at,
            feature="scene-summary-batch",
            system_prompt=build_scene_summary_prompt(node.title, prose),
            user_message=f"Scene: {node.title}\n\n{prose}",
            response=summary,
            node_id=node.id,
            tokens=(620 + 40 * i, 58 + 3 * i),
            latency_ms=2100 + 350 * i,
        )
        node.content_summary = summary
        node.summary_stale = False
        node.summary_updated_at = at

    db.add(
        ActivityLog(
            user_id=user.id,
            story_id=story.id,
            event_type="analysis_run",
            category="health",
            description=(
                f"Scene summaries generated: {len(summarised)} summarized, "
                f"{len(scenes) - len(summarised)} skipped, 0 failed"
            ),
            created_at=start + timedelta(seconds=11),
            metadata_={"feature": "scene-summary-batch", "job_id": summary_job.id},
        )
    )

    # This morning: the Codex suggestion pass, with Ollama not running.
    start = now - timedelta(hours=3)
    error = "Could not reach Ollama at http://localhost:11434 (connection refused). Is it running?"
    failed_job = AIJob(
        user_id=user.id,
        story_id=story.id,
        kind="codex-suggest",
        label=f"Codex suggestions — {story.title}",
        status="error",
        params={},
        progress=0,
        total=len(scenes),
        error=error,
        created_at=start,
        started_at=start + timedelta(seconds=1),
        finished_at=start + timedelta(seconds=2),
    )
    db.add(failed_job)
    db.flush()
    first = scenes[0]
    _call(
        db,
        user=user,
        story=story,
        job=failed_job,
        at=start + timedelta(seconds=1),
        feature="codex-suggest",
        system_prompt=build_codex_suggest_prompt(
            scene_title=first.title or "Untitled scene",
            prose=html_to_text(first.content or "")[:PROSE_LIMIT],
            cast=cast,
            already_present=[],
            known_facts=[],
        ),
        user_message="Index this scene.",
        response="",
        status="error",
        error=error,
        latency_ms=12,
    )
