from pydantic import BaseModel, Field


class AISettingsRead(BaseModel):
    """Current AI settings — user overrides merged with defaults."""

    #: The master switch. Off means no AI surface renders and the gateway refuses calls.
    enabled: bool = True
    #: Seconds the model's jobs wait after the author's last reply (doc 21 P3); 0 for none.
    jobs_cooldown_seconds: int = 60
    #: The model answers several calls at once: replies do not stop jobs, and no cool-down.
    model_parallel: bool = False
    core_prompt: str
    core_prompt_is_custom: bool
    feature_prompts: dict[str, str | None]  # feature_id -> current prompt (None means no override)


class AISettingsUpdate(BaseModel):
    """Partial update for AI settings stored in User.settings["ai"]."""

    enabled: bool | None = None
    jobs_cooldown_seconds: int | None = Field(None, ge=0, le=600)
    model_parallel: bool | None = None
    core_prompt: str | None = None
    feature_prompts: dict[str, str | None] | None = None


class AISettingsDefaults(BaseModel):
    """Default prompts as shipped (not user-customized)."""

    core_prompt: str
    feature_labels: dict[str, str]  # feature_id -> human label
    feature_defaults: dict[str, str]  # feature_id -> default behavioral instruction
    #: feature_id -> co-author class, so a prompt card can say what the feature may return.
    feature_classes: dict[str, str] = {}
