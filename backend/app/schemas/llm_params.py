from typing import Literal

from pydantic import BaseModel, Field

IMAGE_TOKEN_BUDGETS = (70, 140, 280, 560, 1120)


class LLMParams(BaseModel):
    """Per-request or per-user LLM sampling parameters."""

    temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    top_k: int = Field(default=64, ge=1, le=200)
    thinking_enabled: bool = False
    image_token_budget: Literal[70, 140, 280, 560, 1120] | None = None


class LLMSettingsRead(LLMParams):
    """LLM settings as returned by the API — includes whether they're defaults."""

    is_default: bool
    ollama_url: str | None = None  # None = use server default
    ollama_model: str | None = None  # None = use server default
    effective_ollama_url: str = ""  # Resolved value the backend will actually use
    effective_ollama_model: str = ""  # Resolved value the backend will actually use


class LLMSettingsUpdate(BaseModel):
    """Partial update for LLM settings stored in User.settings["llm"]."""

    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1, le=200)
    thinking_enabled: bool | None = None
    image_token_budget: Literal[70, 140, 280, 560, 1120] | None = None
    ollama_url: str | None = None
    ollama_model: str | None = None
