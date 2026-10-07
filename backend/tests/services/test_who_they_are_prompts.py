"""Who are they in the prompts (doc 20 P8, R3): what reaches the model, and what never does."""

from types import SimpleNamespace

from app.services.llm.gateway import ai_gateway
from app.services.llm.prompts.interviews import build_character_interview_system_prompt
from app.services.llm.prompts.panel import build_panel_character_prompt
from app.services.llm.prompts.who_they_are import (
    CARE_RULES,
    MARKER,
    continuity_profile,
    packet_profile,
    render_packet_profile,
)

NOTE = "drowning-note"


def _person(**kw):
    base = dict(
        id="c1", name="Elena", pronouns="she/her", role="protagonist", character_type="", jungian_archetype="",
        narrative_archetype="", mission_statement="", personality="", motivation="", background="",
        appearance="", flaws="", quirks="", speech_patterns="", traits={}, attributes={},
        gender="woman", presentation="", sex="", age="54", orientation="", languages="Russian, English",
        heritage="", faith="", family="", circumstances="", thinking="in phrases and fingerings",
        need="To let someone help her", lie="Being pitied is worse than failing", stakes="",
        sore_spots="Being asked if she's all right", takes_personally="", shows_hurt="Goes very still",
        copes="", holds_on="",
        facets=[
            {"id": "f1", "area": "health", "name": "Parkinson's", "page": "the left hand at rest",
             "impact": "control rationed", "known": "some", "known_to": ["c2"], "assistant": True},
            {"id": "f2", "area": "senses", "name": "hard of hearing", "page": "leans in", "known": "everyone",
             "assistant": False},
        ],
        formative=[
            {"id": "w1", "title": "Her teacher's hands", "what": "He shook and was let go", "impact": "fear of being seen",
             "notes": [NOTE], "wound": True, "known": "only_them", "assistant": True},
        ],
    )  # fmt: skip
    return SimpleNamespace(**{**base, **kw})


def test_the_persona_speaks_from_who_they_are_and_not_what_they_dont_know():
    prompt = build_character_interview_system_prompt(_person())
    for line in ("woman", "in phrases and fingerings", "Parkinson's", "the left hand at rest", "Her teacher's hands",
                 "He shook and was let go", "Being pitied is worse than failing", "Goes very still"):  # fmt: skip
        assert line in prompt, line
    assert "To let someone help her" not in prompt, "Needs is what they don't know"
    assert "hard of hearing" not in prompt, "an entry kept out of the Assistant"
    assert NOTE not in prompt, "content notes are the author's only"
    assert "not the subject of the conversation" in prompt


def test_in_a_group_each_knows_only_what_they_know_of_the_others():
    elena = _person()
    told = _person(id="c2", name="Mira", facets=[], formative=[])
    stranger = _person(id="c3", name="Ruth", facets=[], formative=[])
    assert "Parkinson's" in build_panel_character_prompt(told, [elena], [])
    room = build_panel_character_prompt(stranger, [elena], [])
    assert "Parkinson's" not in room and "Her teacher's hands" not in room
    assert "hard of hearing" not in room


def test_the_scene_packet_carries_what_shows_never_what_happened():
    profile = packet_profile(_person())
    text = " ".join(render_packet_profile(profile))
    assert "the left hand at rest" in text and "fear of being seen" in text
    assert "He shook and was let go" not in text and NOTE not in text and "hard of hearing" not in text


def test_the_continuity_check_knows_pronouns_and_how_a_body_shows():
    line = continuity_profile(_person())
    assert "she/her" in line and "the left hand at rest" in line
    assert "Her teacher's hands" not in line


def test_the_care_rules_go_with_every_call_that_carries_these_fields():
    user = SimpleNamespace(settings={})
    with_who = ai_gateway.compose_prompt(f"Who you are {MARKER}: woman", user, feature_id="interview")
    assert CARE_RULES in with_who
    in_messages = ai_gateway.compose_prompt("Help.", user, messages=[{"role": "user", "content": f"x {MARKER}"}])
    assert CARE_RULES in in_messages
    assert CARE_RULES not in ai_gateway.compose_prompt("Summarise the scene.", user, feature_id="scene-summary")


def test_sensitivity_shapes_the_voice():
    prompt = build_character_interview_system_prompt(_person(attributes={"sensitivity": "feels_everything"}))
    assert "You feel everything" in prompt
