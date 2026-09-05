from pydantic import BaseModel


class AISettingsRead(BaseModel):
    """Current AI settings — user overrides merged with defaults."""

    core_prompt: str
    core_prompt_is_custom: bool
    feature_prompts: dict[str, str | None]  # feature_id -> current prompt (None means no override)


class AISettingsUpdate(BaseModel):
    """Partial update for AI settings stored in User.settings["ai"]."""

    core_prompt: str | None = None
    feature_prompts: dict[str, str | None] | None = None


class AISettingsDefaults(BaseModel):
    """Default prompts as shipped (not user-customized)."""

    core_prompt: str
    feature_labels: dict[str, str]  # feature_id -> human label
    feature_defaults: dict[str, str]  # feature_id -> default behavioral instruction
