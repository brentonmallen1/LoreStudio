"""Books disagree only about enduring fields, and only when both say something."""

from types import SimpleNamespace

from app.services.series.drift import disagree, enduring_disagreements
from app.services.series.kinds import SERIES_KINDS


def test_silence_and_spelling_are_not_disagreement():
    assert not disagree(["Born at sea.", "  born at   SEA. ", "", None])
    assert not disagree(["“Quoted”", '"quoted"'])
    assert disagree(["Born at sea.", "Born inland."])


def test_only_enduring_fields_are_compared():
    character = SERIES_KINDS["character"]
    one = SimpleNamespace(background="Born at sea.", appearance="Grey eyes.", personality="Guarded.")
    two = SimpleNamespace(background="Born inland.", appearance="Grey eyes.", personality="Opening up.")
    assert enduring_disagreements(character, None, [one, two]) == ["background"]
    assert enduring_disagreements(character, None, [one]) == []


def test_a_series_can_make_a_field_enduring_or_let_it_change():
    character = SERIES_KINDS["character"]
    one = SimpleNamespace(background="Born at sea.", personality="Guarded.")
    two = SimpleNamespace(background="Born inland.", personality="Opening up.")
    overrides = {"character": {"background": "evolving", "personality": "enduring"}}
    assert enduring_disagreements(character, overrides, [one, two]) == ["personality"]
