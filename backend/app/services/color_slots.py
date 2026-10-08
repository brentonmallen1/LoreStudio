"""
Palette slots (refactor doc 11, phase 2).

A character, place or plot thread carries a slot number 1..8 rather than a colour; every
theme paints the slots in its own inks, so the same person is the same colour everywhere
and always readable. Slot 0 is "none chosen yet", and a new row takes the least-used slot
so the cast stays distinct for as long as eight colours allow.
"""

from collections import Counter
from collections.abc import Iterable

SLOT_COUNT = 8


def next_slot(used: Iterable[int | None]) -> int:
    """The least-used slot among what is taken; the lowest number on a tie."""
    counts = Counter(u for u in used if u and 1 <= u <= SLOT_COUNT)
    return min(range(1, SLOT_COUNT + 1), key=lambda s: (counts[s], s))
