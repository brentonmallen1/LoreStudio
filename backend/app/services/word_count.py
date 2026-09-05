"""Word count target ranges by intended story length."""

# Maps intended_length values to {min, max, soft_warning_at} in words.
# soft_warning_at = 85% of max (None for unbounded forms).
WORD_COUNT_RANGES: dict[str, dict] = {
    "flash_fiction": {"min": 0, "max": 1_000, "soft_warning_at": 850},
    "short_story": {"min": 1_000, "max": 7_500, "soft_warning_at": 6_375},
    "novelette": {"min": 7_500, "max": 17_500, "soft_warning_at": 14_875},
    "novella": {"min": 17_500, "max": 40_000, "soft_warning_at": 34_000},
    "novel": {"min": 40_000, "max": 100_000, "soft_warning_at": 85_000},
    "epic_saga": {"min": 100_000, "max": None, "soft_warning_at": None},
    "series": {"min": None, "max": None, "soft_warning_at": None},
}


def get_word_count_status(intended_length: str, current_words: int) -> dict | None:
    """
    Returns word count target info for the given intended_length.
    Returns None if the form is unbounded or not recognized.
    """
    ranges = WORD_COUNT_RANGES.get(intended_length)
    if not ranges or ranges["max"] is None:
        return None

    max_words = ranges["max"]
    soft_warning = ranges["soft_warning_at"]
    pct = round(current_words / max_words * 100, 1) if max_words else 0

    if current_words >= max_words:
        warning_level = "exceeded"
    elif soft_warning and current_words >= soft_warning:
        warning_level = "approaching"
    else:
        warning_level = "normal"

    return {
        "min": ranges["min"],
        "max": max_words,
        "soft_warning_at": soft_warning,
        "current": current_words,
        "pct": pct,
        "warning_level": warning_level,
    }
