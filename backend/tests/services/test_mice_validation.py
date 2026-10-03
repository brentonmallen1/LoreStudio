"""Tests for MICE thread LIFO nesting validation."""

from app.services.mice_validation import validate_thread_nesting

# Leaf order used across most tests: nodes s1 through s6 in narrative order.
LEAF_ORDER = ["s1", "s2", "s3", "s4", "s5", "s6"]


def test_no_violations_when_properly_nested(mock_thread):
    """Properly nested threads (B fully inside A) should produce no violations."""
    threads = [
        mock_thread("a", "Outer Thread", mice_type="idea", opens_at="s1", closes_at="s4"),
        mock_thread("b", "Inner Thread", mice_type="character", opens_at="s2", closes_at="s3"),
    ]
    assert validate_thread_nesting(threads, LEAF_ORDER) == []


def test_violation_when_inner_closes_after_outer(mock_thread):
    """Crossing threads (B opens inside A but closes after A) should flag B."""
    threads = [
        mock_thread("a", "Thread A", mice_type="idea", opens_at="s1", closes_at="s3"),
        mock_thread("b", "Thread B", mice_type="character", opens_at="s2", closes_at="s4"),
    ]
    violations = validate_thread_nesting(threads, LEAF_ORDER)
    assert len(violations) == 1
    assert violations[0]["thread_id"] == "b"
    assert violations[0]["conflicting_thread_id"] == "a"
    assert "reverse order" in violations[0]["message"]


def test_no_validation_with_single_thread(mock_thread):
    """A single MICE thread can't violate nesting — needs at least 2."""
    threads = [
        mock_thread("a", "Only Thread", mice_type="milieu", opens_at="s1", closes_at="s5"),
    ]
    assert validate_thread_nesting(threads, LEAF_ORDER) == []


def test_skips_threads_without_mice_type(mock_thread):
    """Threads with mice_type=None are excluded from validation."""
    threads = [
        mock_thread("a", "Tagged", mice_type="event", opens_at="s1", closes_at="s3"),
        mock_thread("b", "Untagged", mice_type=None, opens_at="s2", closes_at="s4"),
    ]
    # Only 1 typed thread — not enough to validate.
    assert validate_thread_nesting(threads, LEAF_ORDER) == []


def test_skips_threads_without_open_close(mock_thread):
    """Threads missing opens_at or closes_at are skipped during pair checks."""
    threads = [
        mock_thread("a", "Complete", mice_type="idea", opens_at="s1", closes_at="s3"),
        mock_thread("b", "No Close", mice_type="character", opens_at="s2", closes_at=None),
        mock_thread("c", "No Open", mice_type="milieu", opens_at=None, closes_at="s4"),
    ]
    # Incomplete threads are filtered out; only 1 complete thread remains.
    assert validate_thread_nesting(threads, LEAF_ORDER) == []


def test_multiple_violations(mock_thread):
    """Three staggered threads: A(s1→s3), B(s2→s5), C(s4→s6).

    B opens inside A and closes after it; C opens inside B and closes after it. A and C never
    overlap (A has closed before C opens), so they do not cross: 2 violations, not 3.
    """
    threads = [
        mock_thread("a", "Thread A", mice_type="idea", opens_at="s1", closes_at="s3"),
        mock_thread("b", "Thread B", mice_type="character", opens_at="s2", closes_at="s5"),
        mock_thread("c", "Thread C", mice_type="milieu", opens_at="s4", closes_at="s6"),
    ]
    violations = validate_thread_nesting(threads, LEAF_ORDER)
    assert sorted((v["thread_id"], v["conflicting_thread_id"]) for v in violations) == [("b", "a"), ("c", "b")]


def test_threads_that_follow_one_another_do_not_cross(mock_thread):
    """Regression (doc 18): a thread that opens after another has closed is not a crossing,
    and neither is a handover in the scene where one closes and the next opens."""
    threads = [
        mock_thread("a", "First", mice_type="idea", opens_at="s1", closes_at="s2"),
        mock_thread("b", "Second", mice_type="event", opens_at="s3", closes_at="s4"),
        mock_thread("c", "Handover", mice_type="character", opens_at="s4", closes_at="s6"),
    ]
    assert validate_thread_nesting(threads, LEAF_ORDER) == []


def test_simultaneous_open_points(mock_thread):
    """Two threads opening in the same scene nest: the one that closes later holds the other,
    whichever order they come in."""
    threads = [
        mock_thread("a", "Thread A", mice_type="idea", opens_at="s1", closes_at="s3"),
        mock_thread("b", "Thread B", mice_type="character", opens_at="s1", closes_at="s4"),
    ]
    assert validate_thread_nesting(threads, LEAF_ORDER) == []
    assert validate_thread_nesting(list(reversed(threads)), LEAF_ORDER) == []


def test_empty_thread_list():
    """Empty thread list returns empty violations."""
    assert validate_thread_nesting([], LEAF_ORDER) == []


def test_all_threads_properly_nested(mock_thread):
    """Three correctly nested threads (stack order: A wraps B wraps C) pass cleanly."""
    threads = [
        mock_thread("a", "Outer", mice_type="event", opens_at="s1", closes_at="s6"),
        mock_thread("b", "Middle", mice_type="idea", opens_at="s2", closes_at="s5"),
        mock_thread("c", "Inner", mice_type="character", opens_at="s3", closes_at="s4"),
    ]
    assert validate_thread_nesting(threads, LEAF_ORDER) == []
