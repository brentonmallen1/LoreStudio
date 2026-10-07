"""
Settings › AI's model parameters (the route had no tests).

Only what the author changed is saved: a value left alone follows this server's default, which
`.env` may change, and the response says what that default is so the page can show it.
"""

from app.config import settings


def test_the_defaults_are_the_servers_until_changed(client):
    got = client.get("/api/llm-settings").json()
    assert got["is_default"] and got["temperature"] == settings.ollama_temperature
    assert got["server_defaults"]["temperature"] == settings.ollama_temperature


def test_a_change_saves_only_itself_and_reset_clears_it(client, test_user):
    changed = client.patch("/api/llm-settings", json={"temperature": 0.7}).json()
    assert changed["temperature"] == 0.7 and changed["top_p"] == settings.ollama_top_p
    assert test_user.settings["llm"] == {"temperature": 0.7}

    client.patch("/api/llm-settings", json={"image_token_budget": 280})
    client.patch("/api/llm-settings", json={"image_token_budget": None})
    assert "image_token_budget" not in test_user.settings["llm"]

    assert client.delete("/api/llm-settings").json()["is_default"]


def test_thinking_is_a_choice_applied_per_feature(client, test_user):
    from app.services.llm.gateway import ai_gateway

    assert client.get("/api/llm-settings").json()["thinking_mode"] == "helps"
    params = lambda feature: ai_gateway._get_effective_params(test_user, None, feature).thinking_enabled  # noqa: E731
    assert params("plot-holes") and params("scene-chat")
    assert not params("interview") and not params("scene-summary-batch") and not params("unlisted")

    client.patch("/api/llm-settings", json={"thinking_mode": "off"})
    assert not params("plot-holes")
    client.patch("/api/llm-settings", json={"thinking_mode": "always"})
    assert params("interview")


def test_switched_on_before_there_was_a_choice_means_always(client, test_user):
    test_user.settings = {"llm": {"thinking_enabled": True}}
    assert client.get("/api/llm-settings").json()["thinking_mode"] == "always"
    test_user.settings = {"llm": {"thinking_enabled": False}}  # what opening Settings used to save
    assert client.get("/api/llm-settings").json()["thinking_mode"] == "helps"


def test_a_conversation_still_decides_for_itself(test_user):
    from app.schemas.llm_params import LLMParamsOverride
    from app.services.llm.gateway import ai_gateway

    override = LLMParamsOverride(thinking_enabled=True)
    assert ai_gateway._get_effective_params(test_user, override, "interview").thinking_enabled
