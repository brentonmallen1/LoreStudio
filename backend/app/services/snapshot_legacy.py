"""Reading snapshots taken in an older shape (doc 15).

A snapshot is a JSON copy of a story. Restoring one taken before a schema change means
turning what it holds into today's rows.
"""


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
