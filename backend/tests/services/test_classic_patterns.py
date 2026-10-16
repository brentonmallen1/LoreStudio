"""The classic patterns (doc 29 D5) show to writers: one plain name each, and every moment says
in plain words what happens there, in the house style of the rest of the interface."""

from app.services.seed import BEAT_SHEETS


def test_each_pattern_has_its_plain_name_and_line():
    names = {s["id"]: s["name"] for s in BEAT_SHEETS}
    assert names == {
        "three-act-beats": "Three turning points",
        "save-the-cat": "Save the Cat",
        "story-circle": "The story circle",
        "heros-journey": "The hero's journey",
    }
    for sheet in BEAT_SHEETS:
        assert sheet["description"].startswith(f"{len(sheet['beats'])} ")


def test_every_moment_explains_itself_without_dashes_or_shouting():
    for sheet in BEAT_SHEETS:
        positions = [b["position_pct"] for b in sheet["beats"]]
        assert positions == sorted(positions), sheet["id"]
        for beat in sheet["beats"]:
            text = beat["description"]
            assert len(text) > 20, beat["id"]
            assert "—" not in text and "–" not in text, beat["id"]
            # Sentence case: only the first word is capitalized ("B story" keeps its letter).
            assert beat["name"][1:] == beat["name"][1:].lower() or beat["name"].startswith("B "), beat["name"]
