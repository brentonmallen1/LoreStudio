"""Where books disagree about what should stay true (series doc).

Only enduring fields are compared: evolving ones are meant to differ, and their
differences are the progression. A blank field says nothing, so it disagrees with nobody.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from ..findings.fingerprint import normalise
from .kinds import SeriesKind, enduring_fields


def disagree(values: Iterable[Any]) -> bool:
    """Two or more different things said, ignoring case, spacing, quotes and silence."""
    said = {normalise(str(v)) for v in values if v is not None and str(v).strip()}
    return len(said) > 1


def enduring_disagreements(kind: SeriesKind, overrides: dict | None, rows: list[Any]) -> list[str]:
    """The enduring fields the given rows (one per book) do not agree on, in the kind's order."""
    if len(rows) < 2:
        return []
    return [f for f in enduring_fields(kind, overrides) if disagree(getattr(r, f, None) for r in rows)]
