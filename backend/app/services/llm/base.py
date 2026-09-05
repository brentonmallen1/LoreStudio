from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    def chat_stream(self, messages: list[dict], system_prompt: str) -> AsyncIterator[str]:
        """Stream chat response tokens (implemented as an async generator)."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is reachable."""
        ...
