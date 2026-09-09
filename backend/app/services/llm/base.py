"""
What the gateway needs from a model provider (review §1.5).

This used to declare `chat_stream` and `is_available` while the gateway imported the
Ollama singleton directly and called six other methods on it. So the ABC documented an
intention the code did not follow, and "swap the provider" meant editing the gateway.

It now describes the surface the gateway actually uses, and the gateway takes a provider
in its constructor. A second provider is a new class, not a diff.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .ollama import StreamMetrics


class LLMProvider(ABC):
    """A text model this app can talk to."""

    #: Defaults used when the user has set no override.
    model: str
    base_url: str
    #: How long the provider should keep the model resident between calls.
    keep_alive: str

    @abstractmethod
    def chat_stream(self, messages: list[dict], system_prompt: str) -> AsyncIterator[str]:
        """Stream chat response tokens (implemented as an async generator)."""
        ...

    @abstractmethod
    def chat_stream_with_metrics(self, *args: Any, **kwargs: Any) -> AsyncIterator[Any]:
        """Stream tokens, ending with the call's metrics."""
        ...

    @abstractmethod
    async def generate_structured(self, *args: Any, **kwargs: Any) -> "tuple[str, StreamMetrics | None]":
        """One non-streamed call constrained to a JSON schema."""
        ...

    @abstractmethod
    async def get_context_length(self, model_name: str, base_url: str | None = None) -> int | None:
        """The model's own context window, or None when it cannot be determined."""
        ...

    @abstractmethod
    async def embed(self, texts: list[str], *, model: str, base_url: str | None = None) -> list[list[float]]:
        """Embed passages for the Codex index."""
        ...

    @abstractmethod
    async def is_available(self, base_url: str | None = None) -> bool:
        """Whether the provider is reachable."""
        ...
