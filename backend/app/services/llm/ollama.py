import json
import re
from dataclasses import dataclass
from typing import AsyncIterator

import aiohttp

from .base import LLMProvider
from ...config import settings


@dataclass
class StreamMetrics:
    tokens_in: int | None
    tokens_out: int | None
    model: str


# Matches Gemma 4 thought blocks: <|channel>thought\n...<channel|>
_THOUGHT_RE = re.compile(r"<\|channel>thought\n.*?<channel\|>", re.DOTALL)


def strip_thoughts(content: str) -> str:
    """Remove Gemma 4 thought blocks from a message string."""
    return _THOUGHT_RE.sub("", content).strip()


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

    async def model_exists(self, model_name: str, base_url: str | None = None) -> bool:
        """Check if a given model name is available in Ollama (prefix match, ignores :tag)."""
        models = await self.list_models(base_url=base_url)
        base = model_name.split(":")[0].lower()
        for m in models:
            name = m.get("name", "")
            if name == model_name or name.split(":")[0].lower() == base:
                return True
        return False

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
        base_url: str | None = None,
        model: str | None = None,
    ) -> tuple[str, StreamMetrics | None]:
        """
        Call Ollama with format="json" for structured output.
        Returns (raw_response_text, metrics).
        Does NOT stream — waits for the complete response.
        """
        effective_model = model or self.model
        effective_url = base_url or self.base_url
        payload = {
            "model": effective_model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "stream": False,
            "format": "json",
            "keep_alive": self.keep_alive,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "top_p": top_p if top_p is not None else self.top_p,
                "top_k": top_k if top_k is not None else self.top_k,
            },
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{effective_url}/api/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=300),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()
                content = data.get("message", {}).get("content", "")
                metrics = StreamMetrics(
                    tokens_in=data.get("prompt_eval_count"),
                    tokens_out=data.get("eval_count"),
                    model=effective_model,
                ) if data.get("done") else None
                return content, metrics


ollama_provider = OllamaProvider()
