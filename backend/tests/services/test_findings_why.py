"""Findings say why (doc 30 D5): every check that runs without the model carries why it can
matter and what to try, from the one table; the Assistant's findings speak for themselves."""

import re
from pathlib import Path

from app.services.findings import collect
from app.services.findings.data import PROMISE_CHECKS
from app.services.findings.local import _HABITS
from app.services.findings.make import make
from app.services.findings.series import CHECK as SERIES_CANON
from app.services.findings.why import WHY
from tests.fixtures.findings_story import build_findings_story

APP = Path(__file__).resolve().parents[2] / "app" / "services"
#: Where checks without the model make their findings.
SOURCES = ["findings/local.py", "findings/data.py", "findings/series.py", "findings/series_axes.py"]


def _local_checks() -> set[str]:
    """Every check id a non-AI source can produce, read from the code itself, so a new check
    without its why fails here."""
    found: set[str] = set()
    for rel in SOURCES:
        text = (APP / rel).read_text()
        found |= set(re.findall(r'make\(\s*"([a-z_-]+)"', text))
    found |= set(_HABITS) | set(PROMISE_CHECKS) | {SERIES_CANON}
    found |= set(re.findall(r'check="(series-[a-z-]+)"', (APP / "series/promises.py").read_text()))
    return found


def test_every_local_check_says_why_and_what_to_try():
    checks = _local_checks()
    assert {"name_drift", "said_bookisms", "pov_drift", "absent_character", "series-left-open"} <= checks
    missing = sorted(c for c in checks if c not in WHY)
    assert not missing, f"no why/what to try for: {missing}"
    for check in checks:
        why, to_try = WHY[check]
        assert why.strip() and to_try.strip(), check
        # UI copy: no em dashes, and never a rule.
        for words in (why, to_try):
            assert "—" not in words, check
            assert not re.search(r"\b(must|never use|always use|you should)\b", words, re.I), (check, words)


def test_the_table_names_only_real_checks():
    assert set(WHY) <= _local_checks()


def test_a_finding_carries_them_and_the_assistants_do_not():
    f = make("said_bookisms", "prose", "mid", "local", "3 dialogue tags other than said")
    assert f.why.startswith("Words like") and f.what_to_try.startswith("Swap a few")
    ai = make("pacing-analysis", "prose", "mid", "ai", "The middle drags")
    assert ai.why == "" and ai.what_to_try == ""
    own = make("name_drift", "continuity", "mid", "local", "x", why="Mine", what_to_try="Also mine")
    assert (own.why, own.what_to_try) == ("Mine", "Also mine")


def test_the_feed_sends_them(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    feed = collect(story, db_session)
    assert feed.findings
    for f in feed.findings:
        assert f.why and f.what_to_try, f.check
