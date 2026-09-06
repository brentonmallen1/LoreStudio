"""
The co-author contract (refactor doc 06 §5).

LoreStudio's premise is that the author writes the book. That promise used to live in one
softly-worded line — "not to generate content on their behalf unless explicitly asked" —
which several prompts then contradicted: show-don't-tell asked for replacement sentences
"in the style and voice of the original prose", scene atmosphere asked for "a short
suggested opening sentence", and the scene chat prompt carried the loophole verbatim.

The contract is now attached by the gateway from the feature's class, and these tests are
what keep it attached.
"""

import ast
from pathlib import Path

import pytest

from app.services.llm.features import AI_FEATURES, CLASS_LABELS
from app.services.llm.gateway import ai_gateway
from app.services.llm.prompts.chat import build_scene_chat_system_prompt
from app.services.llm.prompts.core import CLASS_RULES, CONTRACT_MARKER, CORE_SYSTEM_PROMPT
from app.services.llm.prompts.scene_atmosphere import build_scene_atmosphere_prompt

DOC_NODES = (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "app" / "services" / "llm" / "prompts"


class FakeUser:
    id = "u1"
    settings: dict = {}


def test_every_class_in_the_table_has_a_contract():
    assert set(CLASS_RULES) == set(CLASS_LABELS)


def test_the_core_prompt_refuses_to_write_prose_even_on_request():
    assert "never write manuscript prose" in CORE_SYSTEM_PROMPT.lower()
    assert "does not change when they ask" in CORE_SYSTEM_PROMPT


@pytest.mark.parametrize("feature", AI_FEATURES, ids=lambda f: f.id)
def test_every_feature_call_carries_its_contract(feature):
    """The gateway composes it, so no builder can forget it."""
    composed = ai_gateway.compose_prompt("FEATURE PROMPT", FakeUser(), True, feature.id)
    assert CONTRACT_MARKER in composed
    assert CLASS_RULES[feature.classification] in composed
    assert "FEATURE PROMPT" in composed


def test_option_features_are_told_to_keep_options_to_one_line():
    assert "one line each" in CLASS_RULES["option"]
    assert "no dialogue" in CLASS_RULES["option"].lower()


def test_the_contract_survives_a_user_overriding_the_core_prompt():
    user = FakeUser()
    user.settings = {"ai": {"core_prompt": "Be whatever you like."}}
    composed = ai_gateway.compose_prompt("F", user, True, "whatif")
    assert "Be whatever you like." in composed
    assert CLASS_RULES["option"] in composed


def test_scene_chat_no_longer_offers_to_write_prose_on_request():
    ctx = {
        "story": {"title": "T"},
        "scene": {"title": "S"},
        "all_characters": [],
        "characters_in_scene": [],
        "open_threads": [],
        "threads_in_scene": [],
        "settings_in_scene": [],
        "sibling_scenes": [],
    }
    prompt = build_scene_chat_system_prompt(ctx)
    assert "unless explicitly asked" not in prompt
    assert "you do not write prose for them" in prompt.lower()


def test_scene_atmosphere_asks_for_cues_not_sentences():
    prompt = build_scene_atmosphere_prompt(2, scene_title="The Lamp Room")
    assert "two to four words" in prompt
    assert "Fragments, not sentences." in prompt
    assert "opening line" in prompt  # named as something it must not write
    assert "sentence I could paste" in prompt


#: Phrasing that would put a builder back in the ghostwriting business. Each of these was
#: in the prompt library before this pass.
BANNED = (
    "unless explicitly asked",
    "suggested opening sentence",
    "in the style and voice of the original prose",
    "write generously",
    "showing alternative (1-3 sentences)",
)


def _prompt_strings(path: Path) -> str:
    """Every string literal in a module except its docstrings — the prompt text itself."""
    tree = ast.parse(path.read_text())
    docstrings = {ast.get_docstring(n, clean=False) for n in ast.walk(tree) if isinstance(n, DOC_NODES)}
    return "\n".join(
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value not in docstrings
    ).lower()


def test_no_prompt_asks_the_model_to_write_the_authors_prose():
    offenders = []
    for path in PROMPTS_DIR.rglob("*.py"):
        text = _prompt_strings(path)
        offenders += [f"{path.name}: {phrase}" for phrase in BANNED if phrase in text]
    assert offenders == []
