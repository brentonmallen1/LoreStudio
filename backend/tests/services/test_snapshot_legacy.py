"""Snapshots taken before a schema change restore into today's rows."""

from app.services.snapshot_legacy import legacy_promises


def test_a_snapshot_from_before_0028_gives_roles_and_clue_rows():
    """Opening, closing and try/fail cycles become roles; JSON clues become rows (doc 18 C1)."""
    state = {
        "structure_nodes": [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}],
        "plot_threads": [
            {
                "id": "t",
                "opens_at_node_id": "s1",
                "closes_at_node_id": "s3",
                "try_fail_cycles": [
                    {"node_id": "s2", "outcome": "fail_disaster", "description": "She hides the log"},
                    {"node_id": "gone", "outcome": "fail_setback", "description": "lost"},
                ],
            }
        ],
        "plot_thread_appearances": [{"id": "a1", "thread_id": "t", "node_id": "s2", "note": "the gap"}],
        "twists": [
            {
                "id": "w",
                "clues": [
                    {"id": "c1", "node_id": "s1", "text": "ash", "points_to": "truth", "subtlety": "hidden"},
                    {"id": "c2", "node_id": "gone", "text": "smoke"},
                ],
            }
        ],
    }
    appearances, clues = legacy_promises(state)
    roles = {a["node_id"]: (a["role"], a["note"]) for a in appearances}
    assert roles == {
        "s1": ("opens", ""),
        "s2": ("fails_worse", "the gap\nShe hides the log"),
        "s3": ("closes", ""),
    }
    assert [(c["id"], c["node_id"], c["position"]) for c in clues] == [("c1", "s1", 0), ("c2", None, 1)]


def test_a_new_snapshot_passes_through():
    state = {
        "structure_nodes": [{"id": "s1"}],
        "plot_threads": [{"id": "t", "set_aside": False}],
        "plot_thread_appearances": [{"id": "a1", "thread_id": "t", "node_id": "s1", "role": "opens", "note": ""}],
        "twists": [{"id": "w", "color_slot": 7}],
        "twist_clues": [{"id": "c1", "twist_id": "w", "node_id": "s1", "text": "ash", "position": 0}],
    }
    appearances, clues = legacy_promises(state)
    assert appearances == state["plot_thread_appearances"] and clues == state["twist_clues"]
