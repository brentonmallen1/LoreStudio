"""
LLM Settings — CRUD for per-user Gemma 4 sampling parameters.

Settings are stored in User.settings["llm"] and override the server-level
defaults from config.py. Per-request overrides (sent in the chat payload)
take the highest priority.

Priority order:
  per-request params > user saved settings > config defaults
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..auth.dependencies import get_current_user
from ..config import settings
from ..database import get_db
from ..models.user import User
from ..schemas.llm_params import LLMSettingsRead, LLMSettingsUpdate
from ..services.llm.ollama import ollama_provider

router = APIRouter()

_DEFAULTS = {
    "temperature": settings.ollama_temperature,
    "top_p": settings.ollama_top_p,
    "top_k": settings.ollama_top_k,
    "thinking_enabled": settings.ollama_thinking_enabled,
    "image_token_budget": None,
}


def _read_user_llm(user: User) -> dict:
    return (user.settings or {}).get("llm", {})


def _build_response(user_llm: dict) -> LLMSettingsRead:
    is_default = len(user_llm) == 0
    return LLMSettingsRead(
        temperature=user_llm.get("temperature", _DEFAULTS["temperature"]),
        top_p=user_llm.get("top_p", _DEFAULTS["top_p"]),
        top_k=user_llm.get("top_k", _DEFAULTS["top_k"]),
        thinking_enabled=user_llm.get("thinking_enabled", _DEFAULTS["thinking_enabled"]),
        image_token_budget=user_llm.get("image_token_budget"),
        num_ctx_max=user_llm.get("num_ctx_max"),
        is_default=is_default,
        ollama_url=user_llm.get("ollama_url"),
        ollama_model=user_llm.get("ollama_model"),
        effective_ollama_url=user_llm.get("ollama_url") or ollama_provider.base_url,
        effective_ollama_model=user_llm.get("ollama_model") or ollama_provider.model,
    )


@router.get("", response_model=LLMSettingsRead)
def get_llm_settings(
    current_user: User = Depends(get_current_user),
):
    """Return the current LLM settings with user overrides applied."""
    return _build_response(_read_user_llm(current_user))


@router.patch("", response_model=LLMSettingsRead)
def update_llm_settings(
    body: LLMSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update LLM settings. Only provided fields are touched."""
    user_settings = dict(current_user.settings or {})
    llm = dict(user_settings.get("llm", {}))

    for field_name in (
        "temperature",
        "top_p",
        "top_k",
        "thinking_enabled",
        "image_token_budget",
        "num_ctx_max",
        "ollama_url",
        "ollama_model",
    ):
        value = getattr(body, field_name)
        if value is not None or field_name in body.model_fields_set:
            if value is None and field_name in body.model_fields_set:
                llm.pop(field_name, None)
            elif value is not None:
                llm[field_name] = value

    user_settings["llm"] = llm
    current_user.settings = user_settings
    flag_modified(current_user, "settings")
    db.commit()

    return _build_response(llm)


@router.delete("", response_model=LLMSettingsRead)
def reset_llm_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset all LLM settings to server defaults."""
    user_settings = dict(current_user.settings or {})
    user_settings.pop("llm", None)
    current_user.settings = user_settings
    flag_modified(current_user, "settings")
    db.commit()

    return _build_response({})
