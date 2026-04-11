"""
Ollama connectivity — connection test and model listing.
"""

from fastapi import APIRouter, Depends

from ..auth.dependencies import get_current_user
from ..models.user import User
from ..services.llm.ollama import ollama_provider

router = APIRouter()


def _user_ollama_config(user: User) -> tuple[str, str]:
    """Return (url, model) for this user — falls back to server defaults."""
    user_llm = (user.settings or {}).get("llm", {})
    url = user_llm.get("ollama_url") or ollama_provider.base_url
    model = user_llm.get("ollama_model") or ollama_provider.model
    return url, model


@router.get("/ollama/status")
async def ollama_status(current_user: User = Depends(get_current_user)):
    """Test connectivity to Ollama using the user's configured URL and model.

    Checks three things in sequence:
      1. Ollama is reachable
      2. The configured model is listed in /api/tags
      3. A minimal 1-token request to the model succeeds
    """
    url, model = _user_ollama_config(current_user)
    connected = await ollama_provider.is_available(base_url=url)
    model_in_list = False
    model_responsive = False
    error: str | None = None

    if connected:
        model_in_list = await ollama_provider.model_exists(model, base_url=url)
        if model_in_list:
            model_responsive, err = await ollama_provider.ping_model(model, base_url=url)
            if not model_responsive:
                error = err
        else:
            error = f"Model '{model}' not found in Ollama — run: ollama pull {model}"

    return {
        "connected": connected,
        "model": model,
        "model_available": model_responsive,
        "model_in_list": model_in_list,
        "error": error,
        "base_url": url,
    }


@router.get("/ollama/models")
async def ollama_models(current_user: User = Depends(get_current_user)):
    """List models available in the user's configured Ollama instance."""
    url, _ = _user_ollama_config(current_user)
    models = await ollama_provider.list_models(base_url=url)
    return {"models": models}


@router.get("/ollama/model-info")
async def ollama_model_info(current_user: User = Depends(get_current_user)):
    """Return the active model name and its context window size."""
    url, model = _user_ollama_config(current_user)
    context_length = await ollama_provider.get_context_length(model, base_url=url)
    return {"model": model, "context_length": context_length}
