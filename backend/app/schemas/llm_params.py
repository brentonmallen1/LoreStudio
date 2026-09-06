from typing import Literal

from pydantic import BaseModel, Field

IMAGE_TOKEN_BUDGETS = (70, 140, 280, 560, 1120)


class LLMParams(BaseModel):
    """Resolved LLM sampling parameters — what the gateway actually sends."""

    temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    top_k: int = Field(default=64, ge=1, le=200)
    thinking_enabled: bool = False
    image_token_budget: Literal[70, 140, 280, 560, 1120] | None = None
    #: Context window for the call. Resolved from the feature budget, the model's own
    #: length and the user ceiling; None only when the model is unreachable.
    num_ctx: int | None = Field(default=None, ge=512, le=1_000_000)


class LLMParamsOverride(BaseModel):
    """
    Per-request overrides. Every field is optional and absent means "use the saved
    setting" — the previous version reused LLMParams here and treated a value equal to
    the default as "not provided", so deliberately choosing temperature 1.0 in a session
    was indistinguishable from leaving it alone and lost to the saved value.
    """

    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1, le=200)
    thinking_enabled: bool | None = None
    image_token_budget: Literal[70, 140, 280, 560, 1120] | None = None
    num_ctx: int | None = Field(default=None, ge=512, le=1_000_000)


class LLMSettingsRead(LLMParams):
    """LLM settings as returned by the API — includes whether they're defaults."""

    is_default: bool
    num_ctx_max: int | None = None  # user ceiling on the context window; None = no ceiling
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
    #: Ceiling on the context window, whatever a feature's budget asks for. VRAM lives here.
    num_ctx_max: int | None = Field(default=None, ge=512, le=1_000_000)
    ollama_url: str | None = None
    ollama_model: str | None = None
