"""Books disagree only when both say something, and never over case, spacing or quotes."""

from app.services.series.drift import disagree


def test_silence_and_spelling_are_not_disagreement():
    assert not disagree(["Born at sea.", "  born at   SEA. ", "", None])
    assert not disagree(["“Quoted”", '"quoted"'])
    assert disagree(["Born at sea.", "Born inland."])
