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

#: The thread manager's old preset hexes, in the order they were offered, and the slot
#: each maps to (blue, violet, pink, red, orange, amber, green, teal → the nearest hue).
PRESET_SLOTS = {
    "#3b82f6": 1,
    "#8b5cf6": 4,
    "#ec4899": 6,
    "#ef4444": 2,
    "#f97316": 2,
    "#f59e0b": 5,
    "#22c55e": 3,
    "#10b981": 3,
    "#14b8a6": 7,
    "#06b6d4": 7,
    "#a78bfa": 4,
    "#6b7280": 8,
}


def next_slot(used: Iterable[int | None]) -> int:
    """The least-used slot among what is taken; the lowest number on a tie."""
    counts = Counter(u for u in used if u and 1 <= u <= SLOT_COUNT)
    return min(range(1, SLOT_COUNT + 1), key=lambda s: (counts[s], s))


def slot_for_hex(color: str | None, fallback: int) -> int:
    """Map an old hex colour to a slot; anything unknown takes the fallback."""
    if not color:
        return fallback
    return PRESET_SLOTS.get(color.strip().lower(), fallback)
