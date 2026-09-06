import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

import aiohttp

logger = logging.getLogger(__name__)

from ...config import settings
from .base import LLMProvider


@dataclass
class StreamMetrics:
    tokens_in: int | None
    tokens_out: int | None
    model: str
    #: True when the provider rejected the JSON schema and the call was retried in
    #: generic JSON mode — the output is then unconstrained, which is worth seeing.
    schema_fallback: bool = False


# Matches Gemma 4 thought blocks: <|channel>thought\n...<channel|>
_THOUGHT_RE = re.compile(r"<\|channel>thought\n.*?<channel\|>", re.DOTALL)


def strip_thoughts(content: str) -> str:
    """Remove Gemma 4 thought blocks from a message string."""
    return _THOUGHT_RE.sub("", content).strip()


def extract_thoughts(content: str) -> str | None:
    """
    The model's reasoning for *this* response, joined, or None.

    Thinking is stripped from history before sending (the model must not be fed its own
    old thoughts), but the current call's reasoning is worth keeping: it is what the
    transparency view shows under "Thinking".
    """
    blocks = _THOUGHT_RE.findall(content)
    return "\n\n".join(b.strip() for b in blocks) or None


def strip_thoughts_from_messages(messages: list[dict]) -> list[dict]:
    """
    Return a copy of messages with thought blocks removed from all assistant turns.
    Gemma 4 requires that previous turn thoughts are not re-sent to the model.
    """
    cleaned = []
    for msg in messages:
        if msg.get("role") == "assistant" and isinstance(msg.get("content"), str):
            cleaned.append({**msg, "content": strip_thoughts(msg["content"])})
        else:
            cleaned.append(msg)
    return cleaned


def _strip_json_fencing(text: str) -> str:
    """Remove markdown code fencing from JSON responses."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Drop first line (```json or ```) and last line (```)
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        text = "\n".join(lines).strip()
    return text


class OllamaProvider(LLMProvider):
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.temperature = settings.ollama_temperature
        self.top_p = settings.ollama_top_p
        self.top_k = settings.ollama_top_k
        self.keep_alive = settings.ollama_keep_alive
        # /api/show is stable for the life of a model tag; one lookup per (host, model).
        self._context_lengths: dict[tuple[str, str], int | None] = {}

    async def is_available(self, base_url: str | None = None) -> bool:
        url = base_url or self.base_url
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{url}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def list_models(self, base_url: str | None = None) -> list[dict]:
        """Return the list of models from Ollama's /api/tags."""
        url = base_url or self.base_url
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{url}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status != 200:
                        return []
                    data = await resp.json()
                    return data.get("models", [])
        except Exception:
            return []

    async def get_context_length(self, model_name: str, base_url: str | None = None) -> int | None:
        """Return the context window size for a model via /api/show.

        Checks model_info.general.context_length first (modern Ollama), then
        falls back to parsing the parameters string for num_ctx.
        Returns None if unavailable or Ollama is unreachable.
        """
        url = base_url or self.base_url
        cache_key = (url, model_name)
        if cache_key in self._context_lengths:
            return self._context_lengths[cache_key]
        length = await self._fetch_context_length(url, model_name)
        self._context_lengths[cache_key] = length
        return length

    async def _fetch_context_length(self, url: str, model_name: str) -> int | None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{url}/api/show",
                    json={"name": model_name},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()
                    # Primary: model_info.general.context_length (integer)
                    model_info = data.get("model_info", {})
                    if ctx := model_info.get("general.context_length"):
                        return int(ctx)
                    # Fallback: parse parameters string for num_ctx
                    params = data.get("parameters", "")
                    for line in params.split("\n"):
                        if line.startswith("num_ctx"):
                            parts = line.split()
                            if len(parts) >= 2:
                                return int(parts[1])
                    return None
        except Exception:
            return None

    async def model_exists(self, model_name: str, base_url: str | None = None) -> bool:
        """Check if a given model name is available in Ollama.

        Exact match always wins. If the configured name has no tag, also matches
        any installed variant of that base (e.g. 'gemma4' matches 'gemma4:latest').
        If the configured name has a tag (e.g. 'gemma4:e4b'), only an exact match
        counts — we do NOT strip tags and cross-match.
        """
        models = await self.list_models(base_url=base_url)
        has_tag = ":" in model_name
        for m in models:
            name = m.get("name", "")
            if name == model_name:
                return True
            if not has_tag and name.split(":")[0].lower() == model_name.lower():
                return True
        return False

    async def ping_model(self, model_name: str, base_url: str | None = None) -> tuple[bool, str]:
        """Send a minimal 1-token request to verify the model actually responds.

        Returns (success, error_message). On success error_message is empty.
        Uses num_predict=1 to keep the response fast.
        """
        url = base_url or self.base_url
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{url}/api/chat",
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": "hi"}],
                        "stream": False,
                        "options": {"num_predict": 1},
                    },
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        return True, ""
                    try:
                        body = await resp.json()
                        return False, body.get("error", f"HTTP {resp.status}")
                    except Exception:
                        return False, f"HTTP {resp.status}"
        except Exception as e:
            return False, str(e)

    async def chat_stream(self, messages: list[dict], system_prompt: str) -> AsyncIterator[str]:
        """Stream response tokens. Discards metrics — use chat_stream_with_metrics for full data."""
        async for chunk in self.chat_stream_with_metrics(messages, system_prompt):
            if isinstance(chunk, str):
                yield chunk

    async def chat_stream_with_metrics(
        self,
        messages: list[dict],
        system_prompt: str,
        *,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        thinking_enabled: bool = False,
        num_ctx: int | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str | StreamMetrics]:
        """
        Stream response tokens, then yield a final StreamMetrics object.
        Callers should check isinstance(chunk, StreamMetrics) for the final item.

        When thinking_enabled is True, <|think|> is prepended to the system prompt
        so Gemma 4 generates its reasoning before answering.
        """
        cleaned_messages = strip_thoughts_from_messages(messages)
        # Prepend <|think|> to trigger Gemma 4's reasoning output
        effective_system = f"<|think|>\n{system_prompt}" if thinking_enabled else system_prompt
        assembled_messages = [{"role": "system", "content": effective_system}] + cleaned_messages

        effective_model = model or self.model
        effective_url = base_url or self.base_url
        payload = {
            "model": effective_model,
            "messages": assembled_messages,
            "stream": True,
            "think": thinking_enabled,
            "keep_alive": self.keep_alive,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "top_p": top_p if top_p is not None else self.top_p,
                "top_k": top_k if top_k is not None else self.top_k,
                # Without num_ctx Ollama silently truncates to its own default (often 4096),
                # which is why long contexts used to lose their oldest messages unannounced.
                **({"num_ctx": num_ctx} if num_ctx else {}),
            },
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{effective_url}/api/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as resp:
                resp.raise_for_status()
                async for line in resp.content:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if data.get("done"):
                            yield StreamMetrics(
                                tokens_in=data.get("prompt_eval_count"),
                                tokens_out=data.get("eval_count"),
                                model=effective_model,
                            )
                            break
                    except json.JSONDecodeError:
                        continue

    async def generate_structured(
        self,
        messages: list[dict],
        system_prompt: str,
        *,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        num_ctx: int | None = None,
        base_url: str | None = None,
        model: str | None = None,
        response_schema: dict | None = None,
    ) -> tuple[str, StreamMetrics | None]:
        """
        Call Ollama for structured output.
        Returns (raw_response_text, metrics).
        Does NOT stream — waits for the complete response.

        When response_schema is provided (a JSON Schema dict from a Pydantic model),
        Ollama uses constrained decoding to guarantee the output matches the schema.
        Falls back to generic format="json" if no schema is given.
        """
        effective_model = model or self.model
        effective_url = base_url or self.base_url
        schema_fallback = False
        payload = {
            "model": effective_model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "stream": False,
            "format": response_schema if response_schema is not None else "json",
            "keep_alive": self.keep_alive,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "top_p": top_p if top_p is not None else self.top_p,
                "top_k": top_k if top_k is not None else self.top_k,
                # Without num_ctx Ollama silently truncates to its own default (often 4096),
                # which is why long contexts used to lose their oldest messages unannounced.
                **({"num_ctx": num_ctx} if num_ctx else {}),
            },
        }
        async with aiohttp.ClientSession() as http_session:
            async with http_session.post(
                f"{effective_url}/api/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as resp:
                if resp.status in (400, 404, 422) and response_schema is not None:
                    # Ollama <0.5 doesn't support schema-constrained format; fall back to
                    # generic JSON mode and let Pydantic validation handle the output.
                    # BUT: 404 can also mean the model doesn't exist — check the body first.
                    if resp.status == 404:
                        try:
                            err_body = await resp.json()
                            err_msg = err_body.get("error", "")
                        except Exception:
                            err_msg = await resp.text()
                        if "not found" in err_msg.lower() or "model" in err_msg.lower():
                            raise ValueError(f"Ollama model error: {err_msg}")
                    logger.warning(
                        "generate_structured: schema format rejected (%s), retrying with format='json'",
                        resp.status,
                    )
                    payload["format"] = "json"
                    schema_fallback = True
                    async with http_session.post(
                        f"{effective_url}/api/chat",
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=300),
                    ) as fallback_resp:
                        if fallback_resp.status == 404:
                            try:
                                err_body = await fallback_resp.json()
                                err_msg = err_body.get("error", "")
                            except Exception:
                                err_msg = await fallback_resp.text()
                            raise ValueError(f"Ollama model error: {err_msg}")
                        fallback_resp.raise_for_status()
                        data = await fallback_resp.json()
                else:
                    if resp.status == 404:
                        try:
                            err_body = await resp.json()
                            err_msg = err_body.get("error", "")
                        except Exception:
                            err_msg = await resp.text()
                        raise ValueError(f"Ollama model error: {err_msg}")
                    resp.raise_for_status()
                    data = await resp.json()
                content = data.get("message", {}).get("content", "")
                metrics = (
                    StreamMetrics(
                        tokens_in=data.get("prompt_eval_count"),
                        tokens_out=data.get("eval_count"),
                        model=effective_model,
                        schema_fallback=schema_fallback,
                    )
                    if data.get("done")
                    else None
                )
                return content, metrics


ollama_provider = OllamaProvider()
