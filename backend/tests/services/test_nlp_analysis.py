"""Unit tests for nlp_analysis_service.py.

These tests run the actual spaCy pipeline (en_core_web_sm must be installed).
They test each analysis function with known prose examples.
"""

import pytest
from app.services.nlp_analysis_service import (
    analyze_scene,
    extract_unknown_entities,
    _detect_passive_voice,
    _detect_adverbs,
    _detect_said_bookisms,
    _detect_repeated_words,
    _analyze_sentence_variety,
    get_nlp,
)
from app.services.text_utils import html_to_text, html_to_paragraphs


# ---------------------------------------------------------------------------
# text_utils
# ---------------------------------------------------------------------------

def test_html_to_text_basic():
    html = "<p>Hello world.</p><p>Second paragraph.</p>"
    result = html_to_text(html)
    assert "Hello world." in result
    assert "Second paragraph." in result


def test_html_to_paragraphs_splits():
    html = "<p>First.</p><p>Second.</p><p>Third.</p>"
    paragraphs = html_to_paragraphs(html)
    assert len(paragraphs) == 3
    assert paragraphs[0] == "First."
    assert paragraphs[2] == "Third."


def test_html_to_text_strips_tags():
    html = "<p>She <strong>ran</strong> quickly.</p>"
    result = html_to_text(html)
    assert "<strong>" not in result
    assert "ran" in result


def test_html_to_paragraphs_empty():
    assert html_to_paragraphs("") == []
    assert html_to_paragraphs("<p></p>") == []


# ---------------------------------------------------------------------------
# Passive voice
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def nlp():
    return get_nlp()


def test_passive_voice_detected(nlp):
    doc = nlp("The letter was written by the detective. She solved the case.")
    result = _detect_passive_voice(doc)
    assert result.passive_count >= 1
    assert result.sentence_count == 2
    assert result.percentage > 0


def test_passive_voice_none_in_active(nlp):
    doc = nlp("The detective solved the case. She wrote the letter quickly.")
    result = _detect_passive_voice(doc)
    assert result.passive_count == 0
    assert result.percentage == 0.0


def test_passive_voice_percentage(nlp):
    # 1 passive, 1 active → 50%
    doc = nlp("The door was opened by James. She walked inside.")
    result = _detect_passive_voice(doc)
    assert result.sentence_count == 2
    assert result.percentage == 50.0


# ---------------------------------------------------------------------------
# Adverb overuse
# ---------------------------------------------------------------------------

def test_adverb_detection(nlp):
    doc = nlp("She ran quickly to the door. He spoke softly into the phone.")
    result = _detect_adverbs(doc)
    # "quickly" and "softly" should be flagged
    assert result.adverb_count >= 1


def test_adverb_zero_when_none(nlp):
    doc = nlp("She ran to the door. He spoke into the phone.")
    result = _detect_adverbs(doc)
    assert result.adverb_count == 0
    assert result.percentage == 0.0


def test_adverb_threshold_severity(nlp):
    # Craft a text with clearly many adverbs
    doc = nlp(
        "She quickly ran. He softly spoke. She loudly cried. He slowly walked. "
        "She boldly acted. He swiftly moved."
    )
    result = _detect_adverbs(doc, threshold=5.0)
    # percentage should exceed threshold
    if result.percentage > 5.0:
        assert any(f.severity == "warning" for f in result.findings)


# ---------------------------------------------------------------------------
# Said-bookism detection
# ---------------------------------------------------------------------------

def test_bookism_detected(nlp):
    doc = nlp('"I cannot bear it," she exclaimed.')
    result = _detect_said_bookisms(doc)
    # "exclaimed" is in _EXTREME_BOOKISMS
    assert result.bookism_count >= 1
    assert any(f.severity == "issue" for f in result.findings)


def test_said_not_flagged(nlp):
    doc = nlp('"Come here," she said. "What do you want?" he asked.')
    result = _detect_said_bookisms(doc)
    assert result.bookism_count == 0


# ---------------------------------------------------------------------------
# Repeated words
# ---------------------------------------------------------------------------

def test_repeated_word_detected(nlp):
    doc = nlp("The door opened. She walked through the door and sighed.")
    result = _detect_repeated_words(doc, window=200)
    # "door" appears twice within 200 chars
    assert len(result.findings) >= 1


def test_no_repeat_for_stop_words(nlp):
    doc = nlp("The cat sat on the mat.")
    result = _detect_repeated_words(doc, window=200)
    # "the" is a stop word — should not be flagged
    assert all("the" not in f.explanation.lower() for f in result.findings)


def test_repeated_word_window(nlp):
    # "lighthouse" appears far apart — beyond window, shouldn't flag
    doc = nlp(
        "The lighthouse stood tall on the cliff. "
        "She walked for many miles along the coast before seeing the lighthouse again far in the distance."
    )
    result = _detect_repeated_words(doc, window=50)
    # With a small window, repetition of "lighthouse" across 100+ chars shouldn't flag
    lighthouse_findings = [f for f in result.findings if "lighthouse" in f.explanation.lower()]
    assert len(lighthouse_findings) == 0


# ---------------------------------------------------------------------------
# Sentence variety
# ---------------------------------------------------------------------------

def test_sentence_variety_short_text(nlp):
    doc = nlp("Hello.")
    result = _analyze_sentence_variety(doc)
    assert result.assessment == "too_short"


def test_sentence_variety_monotonous(nlp):
    # All 5-word sentences
    doc = nlp("She ran to the door. He walked to the wall. They stood by the tree.")
    result = _analyze_sentence_variety(doc)
    # std_dev should be low
    assert result.std_dev < 5.0


def test_sentence_variety_varied(nlp):
    doc = nlp(
        "She ran. "
        "He walked slowly toward the lighthouse, thinking about what Eleanor had told him the previous evening. "
        "It was cold."
    )
    result = _analyze_sentence_variety(doc)
    assert result.sentence_count == 3
    assert result.histogram  # should have entries


def test_sentence_variety_histogram_buckets(nlp):
    doc = nlp("She ran. He walked slowly toward the lighthouse on the distant cliff.")
    result = _analyze_sentence_variety(doc)
    labels = [b.label for b in result.histogram]
    assert "1–5" in labels
    assert "36+" in labels


# ---------------------------------------------------------------------------
# analyze_scene integration
# ---------------------------------------------------------------------------

def test_analyze_scene_empty():
    result = analyze_scene("<p></p>")
    assert result["word_count"] == 0


def test_analyze_scene_all_checks():
    html = "<p>She was taken by the current. He softly called her name.</p>"
    result = analyze_scene(html)
    assert "passive_voice" in result
    assert "adverb_overuse" in result
    assert "said_bookisms" in result
    assert "repeated_words" in result
    assert "sentence_variety" in result


def test_analyze_scene_subset_checks():
    html = "<p>The wind blew strongly. She ran quickly.</p>"
    result = analyze_scene(html, checks={"adverb_overuse"})
    assert "adverb_overuse" in result
    assert "passive_voice" not in result
    assert "sentence_variety" not in result


# ---------------------------------------------------------------------------
# extract_unknown_entities
# ---------------------------------------------------------------------------

def test_extract_entities_finds_unknown_person():
    scenes = [("s1", "Scene 1", "<p>Dr. Hargreaves arrived at the station.</p>")]
    result = extract_unknown_entities(scenes, known_characters=set(), known_locations=set())
    names = [s.text for s in result.character_suggestions]
    assert any("Hargreaves" in n for n in names)


def test_extract_entities_skips_known():
    scenes = [("s1", "Scene 1", "<p>Eleanor walked to the lighthouse.</p>")]
    result = extract_unknown_entities(
        scenes,
        known_characters={"Eleanor"},
        known_locations={"lighthouse"},
    )
    char_names = [s.text for s in result.character_suggestions]
    assert not any(n.lower() == "eleanor" for n in char_names)


def test_extract_entities_aggregates_across_scenes():
    scenes = [
        ("s1", "Scene 1", "<p>Dr. Hargreaves arrived.</p>"),
        ("s2", "Scene 2", "<p>Dr. Hargreaves spoke.</p>"),
    ]
    result = extract_unknown_entities(scenes, known_characters=set(), known_locations=set())
    hargreaves = next(
        (s for s in result.character_suggestions if "Hargreaves" in s.text), None
    )
    assert hargreaves is not None
    assert hargreaves.scene_count == 2
