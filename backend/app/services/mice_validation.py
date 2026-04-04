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
    typed = [
        t for t in threads
        if t.mice_type and t.opens_at_node_id and t.closes_at_node_id
    ]
    if len(typed) < 2:
        return []

    # Build position lookup (lower index = earlier in story).
    pos: dict[str, int] = {node_id: i for i, node_id in enumerate(leaf_order)}

    def node_pos(node_id: str | None) -> int:
        if node_id is None:
            return -1
        return pos.get(node_id, -1)

    violations = []

    # Check every pair of threads for crossing.
    for i, a in enumerate(typed):
        a_open  = node_pos(a.opens_at_node_id)
        a_close = node_pos(a.closes_at_node_id)
        if a_open == -1 or a_close == -1:
            continue

        for b in typed[i + 1:]:
            b_open  = node_pos(b.opens_at_node_id)
            b_close = node_pos(b.closes_at_node_id)
            if b_open == -1 or b_close == -1:
                continue

            # Determine which opened first.
            if a_open <= b_open:
                outer, inner = a, b
                outer_open, outer_close = a_open, a_close
                inner_open, inner_close = b_open, b_close
            else:
                outer, inner = b, a
                outer_open, outer_close = b_open, b_close
                inner_open, inner_close = a_open, a_close

            # Violation: inner thread closes AFTER outer thread.
            if inner_close > outer_close:
                violations.append({
                    "thread_id": inner.id,
                    "thread_name": inner.name,
                    "message": (
                        f'"{inner.name}" opens after "{outer.name}" but closes after it. '
                        f'MICE threads must close in reverse order of opening (LIFO). '
                        f'Close "{inner.name}" before closing "{outer.name}".'
                    ),
                    "conflicting_thread_id": outer.id,
                    "conflicting_thread_name": outer.name,
                })

    return violations
