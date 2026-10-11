"""
The AI reads a script as a script (doc 25, P7): every call about one carries the screenplay rule,
its scenes go to the model as Fountain, the features that measure length measure pages, the
prose-only feature stands aside, and the features with a screen form use it.
"""

import pytest

from app.models.structure import StoryStructureTemplate
from app.services.llm.features import AI_FEATURES, fits
from app.services.llm.gateway import AICallContext, _is_script, ai_gateway
from app.services.llm.prompts.core import SCRIPT_MARKER
from app.services.llm.prompts.publication import (
    build_book_description_system_prompt,
    build_query_letter_system_prompt,
)
from app.services.seed import STRUCTURE_TEMPLATES
from app.services.seed_screenplay import THE_LIGHT, script_html
from app.services.text_utils import for_model, prose_text

SCENE = script_html(THE_LIGHT)


@pytest.fixture
def script(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    client.patch(f"/api/stories/{story['id']}", json={"intended_length": "short_film"})
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": SCENE})
    return story


@pytest.fixture
def prose(client):
    return client.post("/api/stories", json={"title": "Salt"}).json()


class FakeUser:
    id = "u1"
    settings: dict = {}


def test_every_call_about_a_script_carries_the_screenplay_rule(client, db_session, script, prose):
    assert _is_script(AICallContext(feature="scene-chat", user_id="u", story_id=script["id"]), db_session)
    assert not _is_script(AICallContext(feature="scene-chat", user_id="u", story_id=prose["id"]), db_session)
    assert not _is_script(AICallContext(feature="scene-chat", user_id="u"), db_session)
    composed = ai_gateway.compose_prompt("FEATURE", FakeUser(), True, "scene-chat", script=True)
    assert SCRIPT_MARKER in composed and "never write action, dialogue" in composed
    assert SCRIPT_MARKER not in ai_gateway.compose_prompt("FEATURE", FakeUser(), True, "scene-chat")


def test_a_script_scene_goes_to_the_model_as_fountain():
    text = prose_text(SCENE)
    assert "ELEANOR (V.O.)\n(her father's words)\nThe glass doesn't lie." in text
    assert text.startswith("INT. LIGHTHOUSE, LAMP ROOM - DUSK\n\n")
    assert for_model(SCENE) == text
    # Prose goes as it always has.
    assert for_model("<p>She climbs.</p>") == "<p>She climbs.</p>"
    assert prose_text("<p>She climbs.</p><p>Rain.</p>") == "She climbs. Rain."


def test_dialogue_attribution_is_prose_alone(client, db_session, script, prose, mock_ai_gateway):
    gateway = mock_ai_gateway()
    from app.models import Story

    assert not fits("dialogue-attribution", db_session.get(Story, script["id"]))
    assert fits("dialogue-attribution", db_session.get(Story, prose["id"]))
    assert all(fits(f.id, db_session.get(Story, script["id"])) for f in AI_FEATURES if f.id != "dialogue-attribution")
    r = client.post(f"/api/scenes/{script['start_node_id']}/dialogue/ai-suggest")
    assert r.status_code == 400 and "cue" in r.json()["detail"]
    assert gateway.structured_calls == [] and gateway.stream_calls == []


def test_show_dont_tell_reads_a_script_for_unfilmables(client, script, mock_ai_gateway):
    gateway = mock_ai_gateway(structured_data={"instances": []})
    r = client.post(f"/api/stories/{script['id']}/analyze/show-dont-tell", json={"node_id": script["start_node_id"]})
    assert r.status_code == 200, r.text
    prompt = gateway.structured_calls[0]["feature_prompt"]
    # Only the action is read: a character's dialogue is theirs to say.
    assert "unfilmables" in prompt and "The great lens waits, unlit." in prompt
    assert "The glass doesn't lie" not in prompt and "ELEANOR (V.O.)" not in prompt
    assert "data-el" not in prompt and "fiction editor analyzing prose" not in prompt


@pytest.mark.parametrize(
    ("path", "says", "not_says"),
    [
        ("cliches", "Length: about", "Approximate word count"),
        ("pacing", "pages, about a minute of screen time each", "Total words written"),
        ("first-pass", "LENGTH: ", "TOTAL WORDS"),
        ("economy", "You are a script editor", "short fiction editor"),
    ],
)
def test_length_is_in_pages_for_a_script(client, script, mock_ai_gateway, path, says, not_says):
    gateway = mock_ai_gateway(structured_data={})
    r = client.post(f"/api/stories/{script['id']}/analyze/{path}")
    assert r.status_code == 200, r.text
    prompt = gateway.structured_calls[0]["feature_prompt"]
    assert says in prompt and not_says not in prompt
    if path in ("pacing", "first-pass", "economy"):
        assert "/8 page" in prompt and " words, " not in prompt


def test_a_script_sells_on_a_logline_and_its_pages():
    story = {"title": "Light", "genre": "Thriller"}
    ctx = {"story": story, "characters": [], "script": True, "pages": 104}
    pitch = build_book_description_system_prompt(ctx)
    assert "logline" in pitch and "one-page synopsis" in pitch and "back-cover" not in pitch
    query = build_query_letter_system_prompt(ctx)
    assert "screenwriting manager" in query and "Pages: 104" in query and "literary agent" not in query
    prose_ctx = {"story": story, "characters": [], "word_count": 80_000}
    assert "back-cover" in build_book_description_system_prompt(prose_ctx)
    assert "Word count: ~80,000" in build_query_letter_system_prompt(prose_ctx)


def test_comparable_titles_for_a_script_are_films(client, script, mock_ai_gateway):
    gateway = mock_ai_gateway(structured_data={"suggestions": []})
    assert client.post(f"/api/stories/{script['id']}/publication/comp-titles").status_code == 200
    prompt = gateway.structured_calls[0]["feature_prompt"]
    assert "films or series" in prompt and "published books" not in prompt
