"""
AI Settings — CRUD for user-customizable prompts.

Prompts are stored in User.settings["ai"]["core_prompt"] and
User.settings["ai"]["feature_prompts"][feature_id].

Null/absent = use the shipped default from the PromptLibrary.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..auth.dependencies import get_current_user
from ..schemas.ai_settings import AISettingsRead, AISettingsUpdate, AISettingsDefaults
from ..services.llm.prompts.core import CORE_SYSTEM_PROMPT
from ..services.llm.prompts import FEATURE_LABELS, FEATURE_DEFAULT_INSTRUCTIONS

router = APIRouter()


def _get_ai_settings(user: User) -> dict:
    return (user.settings or {}).get("ai", {})


@router.get("", response_model=AISettingsRead)
def get_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current AI settings with user overrides applied."""
    ai = _get_ai_settings(current_user)
    core_custom = ai.get("core_prompt")
    return AISettingsRead(
        core_prompt=core_custom or CORE_SYSTEM_PROMPT,
        core_prompt_is_custom=bool(core_custom),
        feature_prompts=ai.get("feature_prompts", {}),
    )


@router.get("/defaults", response_model=AISettingsDefaults)
def get_ai_settings_defaults(
    current_user: User = Depends(get_current_user),
):
    """Return the default (non-customized) prompts."""
    return AISettingsDefaults(
        core_prompt=CORE_SYSTEM_PROMPT,
        feature_labels=FEATURE_LABELS,
        feature_defaults=FEATURE_DEFAULT_INSTRUCTIONS,
    )


@router.patch("", response_model=AISettingsRead)
def update_ai_settings(
    body: AISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update AI settings. Pass null to a field to reset it to the default.
    Only the provided fields are touched.
    """
    settings = dict(current_user.settings or {})
    ai = dict(settings.get("ai", {}))

    if body.core_prompt is not None:
        ai["core_prompt"] = body.core_prompt
    elif "core_prompt" in body.model_fields_set:
        # Explicitly set to null — remove override
        ai.pop("core_prompt", None)

    if body.feature_prompts is not None:
        existing_fp = dict(ai.get("feature_prompts", {}))
        for feature_id, value in body.feature_prompts.items():
            if value is None:
                existing_fp.pop(feature_id, None)
            else:
                existing_fp[feature_id] = value
        ai["feature_prompts"] = existing_fp

    settings["ai"] = ai
    current_user.settings = settings
    db.commit()

    core_custom = ai.get("core_prompt")
    return AISettingsRead(
        core_prompt=core_custom or CORE_SYSTEM_PROMPT,
        core_prompt_is_custom=bool(core_custom),
        feature_prompts=ai.get("feature_prompts", {}),
    )


@router.delete("/core-prompt", response_model=AISettingsRead)
def reset_core_prompt(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset the core prompt to the default."""
    settings = dict(current_user.settings or {})
    ai = dict(settings.get("ai", {}))
    ai.pop("core_prompt", None)
    settings["ai"] = ai
    current_user.settings = settings
    db.commit()

    return AISettingsRead(
        core_prompt=CORE_SYSTEM_PROMPT,
        core_prompt_is_custom=False,
        feature_prompts=ai.get("feature_prompts", {}),
    )


@router.delete("/feature-prompts/{feature_id}", response_model=AISettingsRead)
def reset_feature_prompt(
    feature_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset a single feature prompt to the default."""
    settings = dict(current_user.settings or {})
    ai = dict(settings.get("ai", {}))
    fp = dict(ai.get("feature_prompts", {}))
    fp.pop(feature_id, None)
    ai["feature_prompts"] = fp
    settings["ai"] = ai
    current_user.settings = settings
    db.commit()

    core_custom = ai.get("core_prompt")
    return AISettingsRead(
        core_prompt=core_custom or CORE_SYSTEM_PROMPT,
        core_prompt_is_custom=bool(core_custom),
        feature_prompts=fp,
    )
