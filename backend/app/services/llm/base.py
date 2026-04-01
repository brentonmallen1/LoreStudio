from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def chat_stream(self, messages: list[dict], system_prompt: str) -> AsyncIterator[str]:
        """Stream chat response tokens."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is reachable."""
        ...
