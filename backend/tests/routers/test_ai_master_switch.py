"""
The AI switch is a promise, not a hidden button (refactor doc 06 §7).

Writer mode renders no AI affordance; Studio with AI off must do the same *and* refuse
calls, so a stale tab, a keyboard shortcut or a direct request cannot reach a model after
the author has said no.
"""

import pytest

from app.services.llm.gateway import AIDisabledError, ai_gateway


class Off:
    id = "u1"
    settings = {"ai": {"enabled": False}}


class On:
    id = "u1"
    settings: dict = {}


@pytest.mark.anyio
async def test_streaming_is_refused_when_ai_is_off():
    from app.services.llm.gateway import AICallContext

    gen = ai_gateway.stream(
        messages=[{"role": "user", "content": "hi"}],
        feature_prompt="p",
        context=AICallContext(feature="scene-chat", user_id="u1"),
        db=None,
        user=Off(),
    )
    with pytest.raises(AIDisabledError):
        await gen.__anext__()


def test_the_switch_defaults_to_on(client):
    body = client.get("/api/ai-settings").json()
    assert body["enabled"] is True


def test_turning_it_off_and_on_again(client):
    assert client.patch("/api/ai-settings", json={"enabled": False}).json()["enabled"] is False
    assert client.get("/api/ai-settings").json()["enabled"] is False
    assert client.patch("/api/ai-settings", json={"enabled": True}).json()["enabled"] is True


def test_prompt_cards_can_say_what_a_feature_may_return(client):
    defaults = client.get("/api/ai-settings/defaults").json()
    assert defaults["feature_classes"]["interview"] == "persona"
    assert defaults["feature_classes"]["whatif"] == "option"


def test_resetting_a_prompt_does_not_switch_ai_back_on(client):
    client.patch("/api/ai-settings", json={"enabled": False})
    assert client.delete("/api/ai-settings/core-prompt").json()["enabled"] is False
