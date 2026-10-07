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
