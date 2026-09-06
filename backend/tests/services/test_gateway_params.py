"""
Parameter resolution and the context window (refactor doc 06 §4).

Two things are under test. Overrides used to be detected by comparing a request value
against the default — so a session that deliberately asked for temperature 1.0 was
indistinguishable from one that asked for nothing, and lost to the saved setting. And no
call ever sent `num_ctx`, which left Ollama to apply its own default (often 4096) and
silently drop the oldest context on long calls.
"""

import pytest

from app.schemas.llm_params import LLMParamsOverride
from app.services.llm.features import BUDGET_LARGE, BUDGET_SMALL
from app.services.llm.gateway import MIN_NUM_CTX, ai_gateway
from app.services.llm.ollama import ollama_provider


class FakeUser:
    def __init__(self, settings=None):
        self.id = "u1"
        self.settings = settings or {}


def test_saved_settings_beat_config_defaults():
    user = FakeUser({"llm": {"temperature": 0.4, "top_k": 12}})
    params = ai_gateway._get_effective_params(user, None)
    assert params.temperature == 0.4
    assert params.top_k == 12


def test_request_value_equal_to_the_default_still_wins():
    user = FakeUser({"llm": {"temperature": 0.4}})
    params = ai_gateway._get_effective_params(user, LLMParamsOverride(temperature=1.0))
    assert params.temperature == 1.0


def test_absent_request_fields_leave_saved_settings_alone():
    user = FakeUser({"llm": {"temperature": 0.4, "top_p": 0.5}})
    params = ai_gateway._get_effective_params(user, LLMParamsOverride(top_p=0.9))
    assert params.temperature == 0.4
    assert params.top_p == 0.9


def test_thinking_can_be_turned_off_per_request():
    user = FakeUser({"llm": {"thinking_enabled": True}})
    params = ai_gateway._get_effective_params(user, LLMParamsOverride(thinking_enabled=False))
    assert params.thinking_enabled is False


@pytest.fixture
def no_model_lookup(monkeypatch):
    """Ollama is not running in tests; pretend /api/show told us nothing."""

    async def _none(model, base_url=None):
        return None

    monkeypatch.setattr(ollama_provider, "get_context_length", _none)


@pytest.mark.anyio
async def test_num_ctx_comes_from_the_feature_budget(no_model_lookup):
    params = ai_gateway._get_effective_params(FakeUser(), None)
    value = await ai_gateway._resolve_num_ctx("continuity-check", params, FakeUser(), "m", None)
    assert value == BUDGET_LARGE
    small = await ai_gateway._resolve_num_ctx("scene-atmosphere", params, FakeUser(), "m", None)
    assert small == BUDGET_SMALL


@pytest.mark.anyio
async def test_user_ceiling_caps_the_budget(no_model_lookup):
    user = FakeUser({"llm": {"num_ctx_max": 8192}})
    params = ai_gateway._get_effective_params(user, None)
    assert await ai_gateway._resolve_num_ctx("continuity-check", params, user, "m", None) == 8192


@pytest.mark.anyio
async def test_the_model_limit_caps_the_budget(monkeypatch):
    async def _small(model, base_url=None):
        return 4096

    monkeypatch.setattr(ollama_provider, "get_context_length", _small)
    user = FakeUser()
    params = ai_gateway._get_effective_params(user, None)
    assert await ai_gateway._resolve_num_ctx("continuity-check", params, user, "m", None) == 4096


@pytest.mark.anyio
async def test_never_asks_for_a_window_too_small_to_work(monkeypatch):
    async def _tiny(model, base_url=None):
        return 128

    monkeypatch.setattr(ollama_provider, "get_context_length", _tiny)
    user = FakeUser()
    params = ai_gateway._get_effective_params(user, None)
    assert await ai_gateway._resolve_num_ctx("scene-chat", params, user, "m", None) == MIN_NUM_CTX


@pytest.mark.anyio
async def test_context_length_is_fetched_once_per_model(monkeypatch):
    """/api/show is stable for a model tag; it used to be fetched on every client build."""
    calls: list[str] = []

    async def _fetch(url, model_name):
        calls.append(model_name)
        return 8192

    ollama_provider._context_lengths.clear()
    monkeypatch.setattr(ollama_provider, "_fetch_context_length", _fetch)
    assert await ollama_provider.get_context_length("gemma4") == 8192
    assert await ollama_provider.get_context_length("gemma4") == 8192
    assert await ollama_provider.get_context_length("other") == 8192
    assert calls == ["gemma4", "other"]
    ollama_provider._context_lengths.clear()
