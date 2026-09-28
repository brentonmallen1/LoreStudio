"""
A new story's first outline, so choosing a structure gives you something to write in.

Picking "Three-Act Structure" used to create nothing: the author then added an act, named
it, selected it, added a chapter, named it, selected it, added a scene, named it and
opened it — twelve steps before the first word. Now the template's top level is laid
out (its acts, beats or stages, named the way the template names them), the first of
them gets one node at each level below it, and that deepest node is where writing starts.

These are starting points, not structure the author has to keep: every node is ordinary
and can be renamed, moved or deleted.
"""

from sqlalchemy.orm import Session

from ..models.structure import StoryStructureTemplate, StructureNode

#: The top-level nodes a built-in template starts with. Templates not listed here (the
#: author's own, and the ones with no natural names) start with one numbered node.
TOP_LEVEL: dict[str, list[str]] = {
    "three-act": ["Act 1: Setup", "Act 2: Confrontation", "Act 3: Resolution"],
    "seven-point": [
        "Hook",
        "Plot Turn 1",
        "Pinch Point 1",
        "Midpoint",
        "Pinch Point 2",
        "Plot Turn 2",
        "Resolution",
    ],
    "heros-journey": [
        "The Ordinary World",
        "The Call to Adventure",
        "Refusal of the Call",
        "Meeting the Mentor",
        "Crossing the Threshold",
        "Tests, Allies, Enemies",
        "Approach to the Inmost Cave",
        "The Ordeal",
        "The Reward",
        "The Road Back",
        "The Resurrection",
        "Return with the Elixir",
    ],
}

#: Templates whose "levels" are kinds of beat that sit side by side, not a hierarchy.
#: A single MICE thread is an opening, try/fail beats and a resolution, all at one depth.
FLAT: dict[str, list[tuple[str, str]]] = {
    "mice-single": [("opening", "Opening"), ("try/fail beat", "Try / Fail"), ("resolution", "Resolution")],
}


def starter_titles(template_id: str | None, levels: list) -> list[str]:
    """The top-level titles a template starts with, for the New Story dialog to preview."""
    if not levels:
        return []
    if template_id in FLAT:
        return [title for _, title in FLAT[template_id]]
    return TOP_LEVEL.get(template_id or "", [f"{levels[0]['name']} 1"])


def _node(story_id: str, parent: StructureNode | None, level: int, level_type: str, title: str, position: int):
    return StructureNode(
        story_id=story_id,
        parent_id=parent.id if parent else None,
        level=level,
        level_type=level_type,
        title=title,
        position=position,
    )


def scaffold_story(story_id: str, template: StoryStructureTemplate | None, db: Session) -> StructureNode | None:
    """
    Lay out a new story's first outline and return the node to start writing in.

    Returns None when there is nothing to lay out (no template, or one with no levels).
    Flushes but does not commit: the caller owns the transaction.
    """
    levels = (template.levels if template else None) or []
    if not levels:
        return None

    if template and template.id in FLAT:
        nodes = [_node(story_id, None, 0, kind, title, i) for i, (kind, title) in enumerate(FLAT[template.id])]
        db.add_all(nodes)
        db.flush()
        return nodes[0]

    top_type = levels[0]["name"].lower()
    titles = starter_titles(template.id if template else None, levels)
    tops = [_node(story_id, None, 0, top_type, title, i) for i, title in enumerate(titles)]
    db.add_all(tops)
    db.flush()

    # One node at each deeper level under the first, so the first scene is ready to open.
    parent = tops[0]
    for depth, level in enumerate(levels[1:], start=1):
        child = _node(story_id, parent, depth, level["name"].lower(), f"{level['name']} 1", 0)
        db.add(child)
        db.flush()
        parent = child
    return parent
