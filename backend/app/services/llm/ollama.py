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


class OllamaProvider(LLMProvider):
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.temperature = settings.ollama_temperature
        self.top_p = settings.ollama_top_p
        self.top_k = settings.ollama_top_k
        self.keep_alive = settings.ollama_keep_alive

    async def is_available(self) -> bool:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status == 200
        except Exception:
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
    ) -> AsyncIterator[str | StreamMetrics]:
        """
        Stream response tokens, then yield a final StreamMetrics object.
        Callers should check isinstance(chunk, StreamMetrics) for the final item.

        When thinking_enabled is True, <|think|> is prepended to the system prompt
        so Gemma 4 generates its reasoning before answering.
        """
        effective_system = f"<|think|>\n{system_prompt}" if thinking_enabled else system_prompt
        cleaned_messages = strip_thoughts_from_messages(messages)

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": effective_system}] + cleaned_messages,
            "stream": True,
            "keep_alive": self.keep_alive,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "top_p": top_p if top_p is not None else self.top_p,
                "top_k": top_k if top_k is not None else self.top_k,
            },
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/chat",
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
                                model=self.model,
                            )
                            break
                    except json.JSONDecodeError:
                        continue


ollama_provider = OllamaProvider()
