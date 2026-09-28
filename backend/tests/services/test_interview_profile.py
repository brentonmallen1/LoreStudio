"""
The interview persona carries the character's flaws, quirks and way of speaking
(writer-audit.md B8): fields the author fills in plainly are part of who they are.
"""

from app.models.character import Character
from app.services.llm.prompts.interviews import _profile_lines


def test_flaws_quirks_and_speech_reach_the_persona():
    character = Character(
        name="Margaret Holt",
        personality="Economical.",
        flaws="Mistakes bluntness for honesty.",
        quirks="Counts the boats in the harbour every morning.",
        speech_patterns="Short sentences; never asks a question she can make a statement.",
    )
    text = "".join(_profile_lines(character))
    assert "Your flaws: Mistakes bluntness for honesty." in text
    assert "Your quirks: Counts the boats" in text
    assert "Your way of speaking: Short sentences" in text


def test_empty_fields_add_nothing():
    text = "".join(_profile_lines(Character(name="Blank", personality="Quiet.")))
    assert "flaws" not in text and "quirks" not in text and "way of speaking" not in text
