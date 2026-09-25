"""Tests for word count status logic."""

from app.services.word_count import WORD_COUNT_RANGES, get_word_count_status


def test_normal_status():
    result = get_word_count_status("short_story", 3000)
    assert result is not None
    assert result["warning_level"] == "normal"
    assert result["current"] == 3000


def test_approaching_status():
    result = get_word_count_status("short_story", 6500)
    assert result is not None
    assert result["warning_level"] == "approaching"


def test_exceeded_status():
    result = get_word_count_status("short_story", 8000)
    assert result is not None
    assert result["warning_level"] == "exceeded"


def test_percentage_calculation():
    # short_story max = 7500; 3750 / 7500 = 50.0%
    result = get_word_count_status("short_story", 3750)
    assert result is not None
    assert result["pct"] == 50.0


def test_unbounded_form_returns_none():
    assert get_word_count_status("epic_saga", 200_000) is None


def test_unknown_form_returns_none():
    assert get_word_count_status("invalid_form", 5000) is None


def test_series_returns_none():
    assert get_word_count_status("series", 50_000) is None


def test_each_bounded_form_has_expected_keys():
    bounded_forms = ["flash_fiction", "short_story", "novelette", "novella", "novel"]
    for form in bounded_forms:
        result = get_word_count_status(form, 0)
        assert result is not None, f"{form} returned None"
        assert "min" in result
        assert "max" in result
        assert "soft_warning_at" in result
        assert "current" in result
        assert "pct" in result
        assert "warning_level" in result


def test_at_soft_warning_boundary():
    # flash_fiction soft_warning_at = 850; exactly 850 should be "approaching"
    result = get_word_count_status("flash_fiction", 850)
    assert result["warning_level"] == "approaching"


def test_just_below_soft_warning():
    result = get_word_count_status("flash_fiction", 849)
    assert result["warning_level"] == "normal"


def test_at_max_boundary():
    # flash_fiction max = 1000; exactly 1000 should be "exceeded"
    result = get_word_count_status("flash_fiction", 1000)
    assert result["warning_level"] == "exceeded"


def test_zero_words_is_normal():
    result = get_word_count_status("short_story", 0)
    assert result["warning_level"] == "normal"
    assert result["pct"] == 0.0


def test_ranges_constant_structure():
    """WORD_COUNT_RANGES entries must have the three expected keys."""
    for form, data in WORD_COUNT_RANGES.items():
        assert "min" in data, f"{form} missing 'min'"
        assert "max" in data, f"{form} missing 'max'"
        assert "soft_warning_at" in data, f"{form} missing 'soft_warning_at'"


def test_a_scene_is_counted_the_way_the_editor_counts_it():
    """The tree shows the stored count and the editor its own; they must agree."""
    from app.services.word_count import count_words

    assert count_words("<p>The knock came at quarter past nine.</p>") == 7
    # A block boundary ends a word even with no space: not "nine.She".
    assert count_words("<p>nine.</p><p>She waited.</p>") == 3
    # Dialogue speaker tags are metadata, stored escaped; the editor does not count them.
    assert count_words("<p>&lt;Calder&gt; “Ms. Vance,” she said.</p>") == 4
    assert count_words("<p><strong>Bold</strong> and <em>plain</em></p>") == 3
    assert count_words(None) == 0 and count_words("") == 0


def test_the_migration_counts_by_the_same_rule():
    """0014 carries its own copy of the rule; it must not drift from the app's."""
    import importlib.util
    import pathlib

    from app.services.word_count import count_words

    path = pathlib.Path(__file__).parents[2] / "alembic" / "versions" / "0014_recount_words.py"
    spec = importlib.util.spec_from_file_location("m0014", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    for sample in ["<p>a b</p><p>c</p>", "<p>&lt;Maya&gt; Hi — there.</p>", "<h3>Title</h3><p>x</p>", None]:
        assert mod._count(sample) == count_words(sample)
