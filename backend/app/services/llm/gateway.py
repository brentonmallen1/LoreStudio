"""
AI Gateway — single entry point for all LLM calls in LoreStudio.

Every AI feature routes through AIGateway.stream(). The gateway handles:
  - Prompt composition: core system prompt + feature prompt (with user overrides)
  - LLM parameter resolution: per-request params override per-user settings override defaults
  - Thinking mode: injects <|think|> token and strips thoughts from history
  - Metrics capture: token counts, latency, model name
  - Automatic activity logging: every call writes to ActivityLog
  - on_complete callback: lets features persist the response if needed

Usage:
    from ..services.llm.gateway import ai_gateway, AICallContext

    ctx = AICallContext(feature="interview", user_id=user.id, story_id=story.id)

    async def on_complete(result: AICallResult):
        record.content = result.content
        db.commit()

    async for token in ai_gateway.stream(
        messages=llm_messages,
        feature_prompt=system_prompt,
        context=ctx,
        db=db,
        user=current_user,
        on_complete=on_complete,
    ):
        yield token
"""

import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from .ollama import ollama_provider, StreamMetrics
from .prompts.core import CORE_SYSTEM_PROMPT
from ...config import settings
from ...models.user import User
from ...models.activity_log import ActivityLog
from ...schemas.llm_params import LLMParams


@dataclass
class AICallContext:
    """Metadata about an AI call — used for logging and prompt composition."""
    feature: str              # e.g. "interview", "scene-chat", "story-summary"
    user_id: str
    story_id: str | None = None
    character_id: str | None = None
    node_id: str | None = None
    session_id: str | None = None
    tags: list[str] = field(default_factory=list)  # e.g. ["interview-panel", "user-initiated"]
    extra_metadata: dict = field(default_factory=dict)


@dataclass
class AICallResult:
    """Collected result after a streaming call completes."""
    content: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int = 0
    model: str = ""


def _default_params() -> LLMParams:
    return LLMParams(
        temperature=settings.ollama_temperature,
        top_p=settings.ollama_top_p,
        top_k=settings.ollama_top_k,
        thinking_enabled=settings.ollama_thinking_enabled,
    )


class AIGateway:
    """
    Central gateway for all LLM interactions.

    Composes prompts, captures metrics, logs every call, and
    invokes optional callbacks — so individual features don't have to.
    """

    def _get_effective_params(self, user: User, request_params: LLMParams | None) -> LLMParams:
        """
        Resolve effective LLM params with three-layer priority:
          request_params (highest) > user saved settings > config defaults (lowest)
        """
        defaults = _default_params()
        user_llm = (user.settings or {}).get("llm", {})

        merged = LLMParams(
            temperature=user_llm.get("temperature", defaults.temperature),
            top_p=user_llm.get("top_p", defaults.top_p),
            top_k=user_llm.get("top_k", defaults.top_k),
            thinking_enabled=user_llm.get("thinking_enabled", defaults.thinking_enabled),
            image_token_budget=user_llm.get("image_token_budget"),
        )

        if request_params is None:
            return merged

        # Request-level fields override only when explicitly provided
        return LLMParams(
            temperature=request_params.temperature if request_params.temperature != 1.0 else merged.temperature,
            top_p=request_params.top_p if request_params.top_p != 0.95 else merged.top_p,
            top_k=request_params.top_k if request_params.top_k != 64 else merged.top_k,
            thinking_enabled=request_params.thinking_enabled,
            image_token_budget=request_params.image_token_budget or merged.image_token_budget,
        )

    def compose_prompt(
        self,
        feature_prompt: str,
        user: User,
        include_core: bool = True,
    ) -> str:
        """
        Merge the core prompt with a feature-specific prompt.
        User customizations in User.settings["ai"] take precedence over defaults.
        """
        user_ai = (user.settings or {}).get("ai", {})
        core = user_ai.get("core_prompt") or CORE_SYSTEM_PROMPT

        if include_core:
            return f"{core}\n\n---\n\n{feature_prompt}"
        return feature_prompt

    async def stream(
        self,
        messages: list[dict],
        feature_prompt: str,
        context: AICallContext,
        db: Session,
        user: User,
        *,
        llm_params: LLMParams | None = None,
        include_core_prompt: bool = True,
        on_complete: Callable[[AICallResult], Awaitable[None]] | None = None,
    ) -> AsyncIterator[str]:
        """
        Stream an LLM response through the gateway.

        Yields string tokens. After the stream ends, automatically:
          1. Captures metrics (tokens, latency, model)
          2. Writes an ActivityLog entry
          3. Calls on_complete(result) if provided
        """
        params = self._get_effective_params(user, llm_params)
        system_prompt = self.compose_prompt(feature_prompt, user, include_core_prompt)

        start_time = time.monotonic()
        full_response: list[str] = []
        metrics: StreamMetrics | None = None

        try:
            async for chunk in ollama_provider.chat_stream_with_metrics(
                messages,
                system_prompt,
                temperature=params.temperature,
                top_p=params.top_p,
                top_k=params.top_k,
                thinking_enabled=params.thinking_enabled,
            ):
                if isinstance(chunk, StreamMetrics):
                    metrics = chunk
                else:
                    full_response.append(chunk)
                    yield chunk
        finally:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            result = AICallResult(
                content="".join(full_response),
                tokens_in=metrics.tokens_in if metrics else None,
                tokens_out=metrics.tokens_out if metrics else None,
                latency_ms=latency_ms,
                model=metrics.model if metrics else ollama_provider.model,
            )

            self._log_call(context, result, db, params)

            if on_complete and result.content:
                await on_complete(result)

    def _log_call(self, context: AICallContext, result: AICallResult, db: Session, params: LLMParams) -> None:
        """Write an ActivityLog entry for this AI call."""
        try:
            log = ActivityLog(
                user_id=context.user_id,
                story_id=context.story_id,
                event_type=f"ai_{context.feature.replace('-', '_')}",
                category="ai",
                description=f"AI {context.feature}",
                metadata_={
                    "model": result.model,
                    "tokens_in": result.tokens_in,
                    "tokens_out": result.tokens_out,
                    "latency_ms": result.latency_ms,
                    "feature": context.feature,
                    "tags": context.tags or [],
                    "node_id": context.node_id,
                    "character_id": context.character_id,
                    "session_id": context.session_id,
                    "thinking_enabled": params.thinking_enabled,
                    "temperature": params.temperature,
                    **context.extra_metadata,
                },
            )
            db.add(log)
            db.commit()
        except Exception:
            # Logging must never break the AI call itself
            db.rollback()


ai_gateway = AIGateway()
