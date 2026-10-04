"""Reading snapshots taken in an older shape (doc 15).

A snapshot is a JSON copy of a story. Restoring one taken before a schema change means
turning what it holds into today's rows.
"""

import uuid


def legacy_notes(state: dict) -> list[dict]:
    """Every note in a snapshot, whichever format took it (doc 15).

    Before migration 0023 a story kept its notes in three places: ``notes`` held story
    notes (title, content), ``todos`` held to-dos and questions, and each structure node
    carried its margin notes in ``inline_notes``; before 0024 the story row kept its
    unsorted ideas in ``idea_fragments``. A newer snapshot has only note rows.
    """
    rows: dict[str, dict] = {}
    for row in state.get("notes", []):
        if "kind" in row:
            rows[row["id"]] = row
        elif (row.get("content") or "").strip():
            rows[row["id"]] = {
                "id": row["id"],
                "story_id": row.get("story_id"),
                "kind": "idea",
                "content": row["content"],
            }
    for row in state.get("todos", []):
        rows.setdefault(row["id"], row)
    # Before 0024 the story's unsorted brain-dump pieces lived on the story row.
    story = state.get("story") or {}
    for i, piece in enumerate(story.get("idea_fragments") or []):
        if isinstance(piece, dict) and piece.get("id") and not piece.get("filed") and (piece.get("text") or "").strip():
            rows.setdefault(
                piece["id"],
                {
                    "id": piece["id"],
                    "story_id": story.get("id"),
                    "kind": "idea",
                    "content": piece["text"],
                    "position": i,
                },
            )
    for node in state.get("structure_nodes", []):
        meta = node.get("metadata_") if isinstance(node.get("metadata_"), dict) else {}
        for i, note in enumerate(node.get("inline_notes") or meta.get("inline_notes") or []):
            if isinstance(note, dict) and note.get("id") and (note.get("note") or "").strip():
                rows.setdefault(
                    note["id"],
                    {
                        "id": note["id"],
                        "story_id": node.get("story_id"),
                        "kind": "note",
                        "content": note["note"],
                        "node_id": node["id"],
                        "anchor": note.get("anchor"),
                        "source": note.get("source"),
                        "category": note.get("category"),
                        "position": i,
                    },
                )
    return list(rows.values())


_OUTCOME_ROLES = {
    "fail_setback": "fails",
    "fail_disaster": "fails_worse",
    "success_cost": "costs",
    "success_clean": "succeeds",
    "success_partial": "costs",
}


def legacy_promises(state: dict) -> tuple[list[dict], list[dict]]:
    """A snapshot's thread appearances and twist clues, whichever format took it (doc 18 C1).

    Before migration 0028 a thread named its opening and closing scenes and kept its try/fail
    cycles as JSON, and a twist kept its clues as JSON. Now each is a role on the thread's
    scene, or a clue row; this does what the migration did.
    """
    nodes = {n.get("id") for n in state.get("structure_nodes", [])}
    appearances = [dict(a) for a in state.get("plot_thread_appearances", [])]
    by_key = {(a.get("thread_id"), a.get("node_id")): a for a in appearances}
    for thread in state.get("plot_threads", []):

        def place(node_id, role: str, note: str = "", thread_id=thread.get("id")) -> None:
            if not node_id or node_id not in nodes:
                return
            row = by_key.get((thread_id, node_id))
            if row is None:
                row = by_key[(thread_id, node_id)] = {
                    "id": str(uuid.uuid4()),
                    "thread_id": thread_id,
                    "node_id": node_id,
                    "note": "",
                }
                appearances.append(row)
            if row.get("role") in (None, "moves"):
                row["role"] = role
            note = (note or "").strip()
            if note and note not in (row.get("note") or ""):
                row["note"] = f"{row['note']}\n{note}" if row.get("note") else note

        if "opens_at_node_id" not in thread and "try_fail_cycles" not in thread:
            continue
        place(thread.get("opens_at_node_id"), "opens")
        place(thread.get("closes_at_node_id"), "closes")
        for cycle in thread.get("try_fail_cycles") or []:
            if isinstance(cycle, dict):
                place(
                    cycle.get("node_id"),
                    _OUTCOME_ROLES.get(cycle.get("outcome") or "", "fails"),
                    cycle.get("description") or "",
                )

    clues = [dict(c) for c in state.get("twist_clues", [])]
    for twist in state.get("twists", []):
        for position, clue in enumerate(c for c in twist.get("clues") or [] if isinstance(c, dict)):
            clues.append(
                {
                    "id": clue.get("id") or str(uuid.uuid4()),
                    "twist_id": twist.get("id"),
                    "node_id": clue.get("node_id") if clue.get("node_id") in nodes else None,
                    "text": clue.get("text") or "",
                    "points_to": clue.get("points_to") or "truth",
                    "subtlety": clue.get("subtlety") or "moderate",
                    "quote": "",
                    "position": position,
                }
            )
    return appearances, clues
