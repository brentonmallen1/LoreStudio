"""MICE thread nesting validation.

Threads tagged with a mice_type and explicit opens_at_node_id / closes_at_node_id
must close in LIFO order — last opened, first closed. This module detects violations.
"""

from __future__ import annotations


def validate_thread_nesting(
    threads: list,
    leaf_order: list[str],
) -> list[dict]:
    """
    Validate MICE thread LIFO ordering.

    Args:
        threads: list of PlotThread ORM objects that have mice_type set.
        leaf_order: ordered list of all structure node IDs (leaves first, in
            narrative order) used to determine relative positions.

    Returns:
        List of violation dicts:
        [
          {
            "thread_id": str,
            "thread_name": str,
            "message": str,
            "conflicting_thread_id": str | None,
            "conflicting_thread_name": str | None,
          }
        ]
    """
    # Only validate threads that have both an open and close point set.
    typed = [t for t in threads if t.mice_type and t.opens_at_node_id and t.closes_at_node_id]
    if len(typed) < 2:
        return []

    # Build position lookup (lower index = earlier in story).
    pos: dict[str, int] = {node_id: i for i, node_id in enumerate(leaf_order)}

    def node_pos(node_id: str | None) -> int:
        if node_id is None:
            return -1
        return pos.get(node_id, -1)

    spans = []
    for t in typed:
        o, c = node_pos(t.opens_at_node_id), node_pos(t.closes_at_node_id)
        if o != -1 and c != -1 and c >= o:
            spans.append((o, c, t))
    # Earliest open first; a tie goes to the one that closes later (it holds the other).
    spans.sort(key=lambda s: (s[0], -s[1], s[2].name or ""))

    violations = []
    # A crossing: B opens inside A (after A opens, before A closes) and closes after A does.
    # Threads that follow one another, or that hand over in the scene one closes and the next
    # opens, do not cross (doc 18: this used to flag any later thread that closed later).
    for i, (a_open, a_close, outer) in enumerate(spans):
        for b_open, b_close, inner in spans[i + 1 :]:
            if a_open < b_open < a_close < b_close:
                violations.append(
                    {
                        "thread_id": inner.id,
                        "thread_name": inner.name,
                        "message": (
                            f'"{inner.name}" opens inside "{outer.name}" but closes after it. '
                            f"MICE threads close in the reverse order they open. "
                            f'Close "{inner.name}" before "{outer.name}", or open it after.'
                        ),
                        "conflicting_thread_id": outer.id,
                        "conflicting_thread_name": outer.name,
                    }
                )

    return violations
