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

import asyncio
import copy
import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Literal, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from ...config import settings
from ...models.activity_log import ActivityLog
from ...models.ai_call import AICallPayload
from ...models.user import User
from ...schemas.ai_responses import StructuredResult
from ...schemas.llm_params import LLMParams, LLMParamsOverride
from ..job_queue import current_job_id, interrupt_reason
from .base import LLMProvider
from .features import FEATURES_BY_ID, feature_budget
from .gate import cooldown_for, model_gate
from .ollama import StreamMetrics, _strip_json_fencing, extract_thoughts, ollama_provider, strip_thoughts
from .prompts.core import CORE_SYSTEM_PROMPT, class_contract
from .prompts.who_they_are import CARE_RULES, MARKER

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

#: Never ask for less than this, whatever the caps say — a tiny window fails outright.
MIN_NUM_CTX = 2048


@dataclass
class AICallContext:
    """Metadata about an AI call — used for logging and prompt composition."""

    feature: str  # e.g. "interview", "scene-chat", "story-summary"
    user_id: str
    story_id: str | None = None
    character_id: str | None = None
    node_id: str | None = None
    session_id: str | None = None
    tags: list[str] = field(default_factory=list)  # e.g. ["interview-panel", "user-initiated"]
    extra_metadata: dict = field(default_factory=dict)


class AIDisabledError(RuntimeError):
    """
    Raised when a call is attempted while the author has AI switched off.

    The switch hides every AI surface, but hiding a button is a UI decision and this is a
    promise: with AI off, nothing in LoreStudio talks to a model (doc 06 §7).
    """


#: How a call ended. Everything but "ok" used to leave no trace at all.
CallStatus = Literal["ok", "error", "cancelled", "schema-fallback", "invalid-json", "schema-invalid"]

#: Response text kept on the activity row itself so the Chronicle list can render without
#: a second query. The full text lives in the payload.
PREVIEW_CHARS = 240


@dataclass
class AICallResult:
    """Collected result after a call completes — successfully or not."""

    #: The answer, with reasoning removed. What a caller persists and shows.
    content: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    #: Null for a local model. A hosted provider fills this in (review §1.6).
    cost_usd: float | None = None
    latency_ms: int = 0
    model: str = ""
    status: CallStatus = "ok"
    error: str | None = None
    #: The response exactly as it arrived, thinking blocks included.
    raw_response: str = ""
    #: This call's own reasoning, split out of raw_response.
    thinking: str | None = None


def decoding_schema(response_model: type[BaseModel]) -> dict:
    """
    The JSON schema Ollama constrains decoding to, with every property required.

    This is a grammar, not a validator, and the two want different things. A response
    model defaults its fields so a sparse answer still parses; but a grammar with no
    required keys admits `{}`, and a model will take that as the shortest valid answer —
    a continuity check that reports no problems because it did not look. Requiring every
    key makes "nothing found" an explicit empty list. Validation still runs against the
    model itself, defaults and all.
    """
    schema = copy.deepcopy(response_model.model_json_schema())

    def require_all(node: object) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and isinstance(node.get("properties"), dict):
                node["required"] = list(node["properties"])
            for value in node.values():
                require_all(value)
        elif isinstance(node, list):
            for value in node:
                require_all(value)

    require_all(schema)
    return schema


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

    def __init__(self, provider: LLMProvider | None = None) -> None:
        """
        The provider is injected so `LLMProvider` is load-bearing rather than decorative.

        It used to import the Ollama singleton directly, which meant the ABC documented an
        intention the code did not follow and swapping providers meant editing the gateway
        (review §1.5). Tests can now hand in a fake without patching a module global.
        """
        self.provider = provider or ollama_provider

    def _turn(self, user: User, context: AICallContext, db: Session, *, stream: bool = False):
        """The model gate (doc 21 P3): a job's call waits its turn and gives way to a reply;
        a reply goes at once, is listed in Jobs by name, and starts the cool-down when it ends."""
        job_id = current_job_id.get()
        if job_id:
            return model_gate.job(job_id)
        return model_gate.live(
            cooldown_for(user),
            user_id=user.id,
            label=_live_label(context, db),
            session_id=context.session_id,
            can_stop=stream,
        )

    def _refuse_if_disabled(self, user: User) -> None:
        if (user.settings or {}).get("ai", {}).get("enabled") is False:
            raise AIDisabledError("AI is switched off in Settings › AI.")

    def _get_ollama_config(self, user: User) -> tuple[str | None, str | None]:
        """Return (base_url, model) overrides from user settings, or (None, None) to use server defaults."""
        user_llm = (user.settings or {}).get("llm", {})
        return user_llm.get("ollama_url") or None, user_llm.get("ollama_model") or None

    def _get_effective_params(self, user: User, request_params: LLMParamsOverride | None) -> LLMParams:
        """
        Resolve effective LLM params with three-layer priority:
          request_params (highest) > user saved settings > config defaults (lowest)

        A request field counts as provided when it is not None — never by comparing it
        against the default value, which used to drop a deliberate "temperature 1.0".
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

        provided = request_params.model_dump(exclude_none=True)
        return merged.model_copy(update=provided)

    async def _resolve_num_ctx(self, feature: str, params: LLMParams, user: User, model: str, url: str | None) -> int:
        """
        Context window for this call: the feature's budget, capped by what the model can
        actually take and by the user's ceiling (doc 06 §4). Sent on every call — without
        it Ollama falls back to its own default and truncates the oldest context silently.
        """
        wanted = params.num_ctx or feature_budget(feature)
        ceiling = (user.settings or {}).get("llm", {}).get("num_ctx_max")
        if ceiling:
            wanted = min(wanted, int(ceiling))
        model_limit = await self.provider.get_context_length(model, url)
        if model_limit:
            wanted = min(wanted, int(model_limit))
        return max(wanted, MIN_NUM_CTX)

    def compose_prompt(
        self,
        feature_prompt: str,
        user: User,
        include_core: bool = True,
        feature_id: str = "",
        messages: list[dict] | None = None,
    ) -> str:
        """
        Merge the core prompt, the feature's co-author contract and the feature prompt.

        The contract comes from the feature's class in the AI feature table, so it is
        attached by the gateway rather than remembered by each builder. It survives a user
        override of the core prompt: the core prompt is a matter of taste, the contract is
        the product's promise that the author writes the book (doc 06 §5).
        """
        user_ai = (user.settings or {}).get("ai", {})
        core = user_ai.get("core_prompt") or CORE_SYSTEM_PROMPT
        feature = FEATURES_BY_ID.get(feature_id)
        contract = class_contract(feature.classification if feature else None)

        parts = [core] if include_core else []
        if contract:
            parts.append(contract)
        # Who a person is (doc 20 P8): any call that carries those fields carries the rules.
        sent = [feature_prompt, *(str(m.get("content", "")) for m in messages or [])]
        if any(MARKER in text for text in sent):
            parts.append(CARE_RULES)
        parts.append(feature_prompt)
        return "\n\n---\n\n".join(parts)

    async def stream(
        self,
        messages: list[dict],
        feature_prompt: str,
        context: AICallContext,
        db: Session,
        user: User,
        *,
        llm_params: LLMParamsOverride | None = None,
        include_core_prompt: bool = True,
        on_complete: Callable[[AICallResult], Awaitable[None]] | None = None,
        on_result: Callable[[AICallResult], None] | None = None,
    ) -> AsyncIterator[str]:
        """
        Stream an LLM response through the gateway.

        Yields string tokens. After the stream ends, automatically:
          1. Captures metrics (tokens, latency, model)
          2. Writes an ActivityLog entry
          3. Calls on_complete(result) if provided
        """
        self._refuse_if_disabled(user)
        params = self._get_effective_params(user, llm_params)
        system_prompt = self.compose_prompt(feature_prompt, user, include_core_prompt, context.feature, messages)
        user_url, user_model = self._get_ollama_config(user)
        params.num_ctx = await self._resolve_num_ctx(
            context.feature, params, user, user_model or self.provider.model, user_url
        )

        start_time = time.monotonic()
        full_response: list[str] = []
        metrics: StreamMetrics | None = None
        status: CallStatus = "ok"
        error: str | None = None
        _logged = False  # guard against finally running more than once

        try:
            async with self._turn(user, context, db, stream=True) as call:
                chunks = self.provider.chat_stream_with_metrics(
                    messages,
                    system_prompt,
                    temperature=params.temperature,
                    top_p=params.top_p,
                    top_k=params.top_k,
                    thinking_enabled=params.thinking_enabled,
                    num_ctx=params.num_ctx,
                    base_url=user_url,
                    model=user_model,
                )
                async for chunk in chunks:
                    if call is not None and call.stop_requested:
                        # Stop from the Jobs list, perhaps in another window: the stream ends
                        # here, cleanly, and closing the provider's stream stops the model.
                        status, error = "cancelled", "Stopped from Jobs"
                        if close := getattr(chunks, "aclose", None):
                            await close()
                        break
                    if isinstance(chunk, StreamMetrics):
                        metrics = chunk
                    else:
                        full_response.append(chunk)
                        yield chunk
        except (asyncio.CancelledError, GeneratorExit):
            # The author hit stop, or the browser went away, or a job made way for a reply.
            # Half a response is still a call that happened, and Chronicle should say so.
            status = "cancelled"
            error = _why_stopped()
            raise
        except Exception as exc:
            status = "error"
            error = str(exc)
            raise
        finally:
            if not _logged:
                _logged = True
                raw = "".join(full_response)
                result = AICallResult(
                    content=strip_thoughts(raw),
                    tokens_in=metrics.tokens_in if metrics else None,
                    tokens_out=metrics.tokens_out if metrics else None,
                    latency_ms=int((time.monotonic() - start_time) * 1000),
                    model=metrics.model if metrics else self.provider.model,
                    status=status,
                    error=error,
                    raw_response=raw,
                    thinking=extract_thoughts(raw),
                )

                self._log_call(context, result, db, params, messages, system_prompt)

                # Synchronous, for the same reason _log_call is: this runs while a
                # cancellation unwinds, and an awaited call there would never complete.
                if on_result:
                    try:
                        on_result(result)
                    except Exception:
                        logger.exception("on_result hook failed for %s", context.feature)

                # Never awaited while unwinding a cancellation: an async generator may not
                # await after GeneratorExit.
                if on_complete and result.content and status == "ok":
                    await on_complete(result)

    async def generate_structured(
        self,
        response_model: type[T],
        messages: list[dict],
        feature_prompt: str,
        context: AICallContext,
        db: Session,
        user: "User",
        *,
        llm_params: LLMParamsOverride | None = None,
        include_core_prompt: bool = True,
    ) -> StructuredResult:
        """
        Generate a structured JSON response and validate it against response_model.

        Always returns a StructuredResult — never raises on parse/validation failure.
        - success=True:  result.data contains the validated model as a dict
        - success=False: result.raw_data has the parsed JSON (if any), result.raw_text has raw response
        """
        self._refuse_if_disabled(user)
        params = self._get_effective_params(user, llm_params)
        system_prompt = self.compose_prompt(feature_prompt, user, include_core_prompt, context.feature, messages)
        user_url, user_model = self._get_ollama_config(user)
        params.num_ctx = await self._resolve_num_ctx(
            context.feature, params, user, user_model or self.provider.model, user_url
        )

        start_time = time.monotonic()

        schema = decoding_schema(response_model)

        try:
            async with self._turn(user, context, db):
                raw_text, metrics = await self.provider.generate_structured(
                    messages,
                    system_prompt,
                    temperature=params.temperature,
                    top_p=params.top_p,
                    top_k=params.top_k,
                    num_ctx=params.num_ctx,
                    base_url=user_url,
                    model=user_model,
                    response_schema=schema,
                    thinking_enabled=params.thinking_enabled,
                )
        except asyncio.CancelledError:
            # Stopped mid-call (a job's Stop, or making way for a reply). CancelledError is
            # not an Exception, so without this the call happened and left no trace in the
            # Chronicle; `stream` logs its own.
            stopped = AICallResult(
                content="",
                latency_ms=int((time.monotonic() - start_time) * 1000),
                model=user_model or self.provider.model,
                status="cancelled",
                error=_why_stopped(),
            )
            self._log_call(context, stopped, db, params, messages, system_prompt, response_format=schema)
            raise
        except Exception as e:
            logger.warning("generate_structured Ollama call failed: %s", e)
            failed = AICallResult(
                content="",
                latency_ms=int((time.monotonic() - start_time) * 1000),
                model=user_model or self.provider.model,
                status="error",
                error=str(e),
            )
            self._log_call(context, failed, db, params, messages, system_prompt, response_format=schema)
            return StructuredResult(success=False, raw_text=f"Error reaching LLM: {e}")

        result_obj = AICallResult(
            content=strip_thoughts(raw_text),
            tokens_in=metrics.tokens_in if metrics else None,
            tokens_out=metrics.tokens_out if metrics else None,
            latency_ms=int((time.monotonic() - start_time) * 1000),
            model=metrics.model if metrics else self.provider.model,
            raw_response=raw_text,
            thinking=extract_thoughts(raw_text),
            # A provider that rejected the schema answered without constraints; the author
            # should be able to see that in Chronicle rather than guess at a bad result.
            status="schema-fallback" if metrics and metrics.schema_fallback else "ok",
        )

        # Step 1: Parse JSON
        cleaned = _strip_json_fencing(strip_thoughts(raw_text))
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("generate_structured: JSON parse failed for feature=%s", context.feature)
            result_obj.status = "invalid-json"
            result_obj.error = "Response was not JSON"
            self._log_call(context, result_obj, db, params, messages, system_prompt, response_format=schema)
            return StructuredResult(
                success=False,
                raw_text=raw_text,
                tokens_in=result_obj.tokens_in,
                tokens_out=result_obj.tokens_out,
                model=result_obj.model,
            )

        # Step 2: Validate against schema
        try:
            validated = response_model.model_validate(data)
        except ValidationError as e:
            logger.warning("generate_structured: schema validation failed for feature=%s: %s", context.feature, e)
            result_obj.status = "schema-invalid"
            result_obj.error = str(e)[:2000]
            self._log_call(context, result_obj, db, params, messages, system_prompt, response_format=schema)
            return StructuredResult(
                success=False,
                raw_data=data,
                raw_text=raw_text,
                tokens_in=result_obj.tokens_in,
                tokens_out=result_obj.tokens_out,
                model=result_obj.model,
            )

        self._log_call(context, result_obj, db, params, messages, system_prompt, response_format=schema)
        return StructuredResult(
            success=True,
            data=validated.model_dump(),
            tokens_in=result_obj.tokens_in,
            tokens_out=result_obj.tokens_out,
            model=result_obj.model,
        )

    def _sent_options(self, params: LLMParams) -> dict:
        """Exactly what went into the request's `options`, for the record."""
        return {
            "temperature": params.temperature,
            "top_p": params.top_p,
            "top_k": params.top_k,
            "num_ctx": params.num_ctx,
            "think": params.thinking_enabled,
            "keep_alive": self.provider.keep_alive,
        }

    def _log_call(
        self,
        context: AICallContext,
        result: AICallResult,
        db: Session,
        params: LLMParams,
        messages: list[dict],
        system_prompt: str = "",
        *,
        response_format: dict | None = None,
    ) -> None:
        """
        Record the call: a summary row in ActivityLog and the prose in AICallPayload.

        Called for every outcome, including errors and cancellations — a call that failed
        is exactly the one the author wants to inspect (doc 06 §3).
        """
        if context.feature not in FEATURES_BY_ID:
            logger.warning("AI call with unregistered feature %r — add it to services/llm/features.py", context.feature)
        try:
            user_messages = [m for m in messages if m.get("role") == "user"]
            last_prompt = user_messages[-1]["content"] if user_messages else None

            description = f"AI {context.feature}"
            if last_prompt:
                preview = last_prompt[:80].replace("\n", " ").strip()
                description = f"{preview}…" if len(last_prompt) > 80 else preview

            log = ActivityLog(
                user_id=context.user_id,
                story_id=context.story_id,
                event_type=f"ai_{context.feature.replace('-', '_')}",
                category="ai",
                description=description,
                cost_usd=result.cost_usd,
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
                    "num_ctx": params.num_ctx,
                    "status": result.status,
                    "error": result.error,
                    # Previews only: the full text is in the payload, which has its own
                    # retention, so the activity list stays cheap to load.
                    "prompt": (last_prompt or "")[:PREVIEW_CHARS] or None,
                    "response": result.content[:PREVIEW_CHARS],
                    "truncated": len(result.content) > PREVIEW_CHARS,
                    **context.extra_metadata,
                },
            )
            db.add(log)
            db.flush()
            db.add(
                AICallPayload(
                    activity_log_id=log.id,
                    system_prompt=system_prompt,
                    messages=messages,
                    raw_response=result.raw_response or result.content,
                    thinking=result.thinking,
                    options=self._sent_options(params),
                    response_format=response_format,
                    context_sources=context.extra_metadata.get("context_sources", []),
                    error=result.error,
                )
            )
            db.commit()
        except Exception:
            # Logging must never break the AI call itself
            logger.exception("failed to record AI call for feature=%s", context.feature)
            db.rollback()


def _live_label(context: AICallContext, db: Session) -> str:
    """A reply as Jobs names it: "Character Interview · Eleanor", "Scene Summary · The Gap"."""
    from ...models.character import Character
    from ...models.structure import StructureNode

    feature = FEATURES_BY_ID.get(context.feature)
    label = feature.label if feature else context.feature
    try:
        if context.character_id and (person := db.get(Character, context.character_id)):
            return f"{label} · {person.name}"
        if context.node_id and (node := db.get(StructureNode, context.node_id)):
            return f"{label} · {node.title}"
    except Exception:  # a name is a nicety; the call must not fail for want of one
        logger.debug("No name for the live call %s", context.feature, exc_info=True)
    return label


def _why_stopped() -> str | None:
    """A job's call cancelled to make way for a reply says so in the Chronicle."""
    job_id = current_job_id.get()
    return "Made way for a reply" if job_id and interrupt_reason(job_id) == "yield" else None


ai_gateway = AIGateway()
