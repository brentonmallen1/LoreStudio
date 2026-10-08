"""Where books disagree about what should stay true (series doc).

Only enduring fields are compared: evolving ones are meant to differ, and their
differences are the progression. A blank field says nothing, so it disagrees with nobody.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from ..findings.fingerprint import normalise


def disagree(values: Iterable[Any]) -> bool:
    """Two or more different things said, ignoring case, spacing, quotes and silence."""
    said = {normalise(str(v)) for v in values if v is not None and str(v).strip()}
    return len(said) > 1
