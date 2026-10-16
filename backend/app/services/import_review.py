"""The structure an import opens on, and the author's edits to it in Review structure.

Every bit of prose is a scene: text between a chapter's heading and its first break, or a
chapter with no break at all, becomes a scene of its own rather than prose held on the chapter,
which the strip, the editor, the export and Numbers all read past.
"""

from __future__ import annotations

from collections.abc import Callable

from ..schemas.import_schemas import BreakPosition, ImportPreviewTree, NodeAdjustment, ParsedParagraph, PreviewNode
from .import_service import _Section, apply_breaks, build_preview_tree


def give_prose_scenes(sections: list[_Section], template_levels: list[dict]) -> list[_Section]:
    """A section above the deepest level keeps only its heading: its prose moves to a new child
    at the deepest level (through a chapter named for it, when an act holds prose), named for it.
    A section a pair of breaks left empty is dropped."""
    deepest = len(template_levels) - 1
    if deepest < 1:
        return sections
    out: list[_Section] = []
    for sec in sections:
        if not sec.content_paras and sec.title_para is None:
            continue
        out.append(sec)
        if sec.level >= deepest or not sec.content_paras:
            continue
        paras, sec.content_paras = sec.content_paras, []
        for level in range(sec.level + 1, deepest + 1):
            child = _Section(level, sec.source, sec.confidence, name=sec.title, anchor=paras[0].index)
            out.append(child)
        child.content_paras = paras
    return out


def prose_sections(
    paragraphs: list[ParsedParagraph], breaks: list[BreakPosition], template_levels: list[dict]
) -> list[_Section]:
    return give_prose_scenes(apply_breaks(paragraphs, breaks, template_levels), template_levels)


def carry_titles(old: ImportPreviewTree, new: ImportPreviewTree) -> ImportPreviewTree:
    """The author's renames, kept on a new split wherever a node starts at the same place."""
    renamed = {(n.paragraph_start, n.level): n.title for n in old.nodes if n.source == "user"}
    nodes = [
        n.model_copy(update={"title": renamed[(n.paragraph_start, n.level)], "source": "user"})
        if (n.paragraph_start, n.level) in renamed
        else n
        for n in new.nodes
    ]
    return new.model_copy(update={"nodes": nodes})


def resegment(
    old: ImportPreviewTree,
    paragraphs: list[ParsedParagraph],
    breaks: list[BreakPosition],
    *,
    retitle: Callable[[ImportPreviewTree], ImportPreviewTree] | None = None,
) -> ImportPreviewTree:
    """A new split of the document (Auto-segment's), titled as the first one was and keeping the
    author's renames. Merges and level changes are not carried: Undo brings them back."""
    tree = build_preview_tree(
        prose_sections(paragraphs, breaks, old.template_levels),
        paragraphs,
        old.session_id,
        old.template_id,
        old.template_levels,
        old.source_format,
        old.detected_title,
    )
    return carry_titles(old, retitle(tree) if retitle else tree)


def _level_type(template_levels: list[dict], level: int) -> str:
    return template_levels[min(level, len(template_levels) - 1)]["name"].lower()


def relabel(preview: ImportPreviewTree, template_id: str, template_levels: list[dict]) -> ImportPreviewTree:
    """The same structure under another template of the same depth: only the level names change."""
    nodes = [n.model_copy(update={"level_type": _level_type(template_levels, n.level)}) for n in preview.nodes]
    return preview.model_copy(update={"nodes": nodes, "template_id": template_id, "template_levels": template_levels})


def _previous_sibling(nodes: list[PreviewNode], idx: int) -> int | None:
    level = nodes[idx].level
    for i in range(idx - 1, -1, -1):
        if nodes[i].level == level:
            return i
        if nodes[i].level < level:
            return None
    return None


def apply_adjustment(
    preview: ImportPreviewTree,
    paragraphs: list[ParsedParagraph],
    adjustment: NodeAdjustment,
) -> ImportPreviewTree:
    """Apply a single user edit to the preview tree. Returns updated tree."""
    nodes = list(preview.nodes)
    idx = next((i for i, n in enumerate(nodes) if n.id == adjustment.node_id), None)
    if idx is None:
        return preview
    target = nodes[idx]

    if adjustment.action == "rename" and adjustment.new_title:
        nodes[idx] = target.model_copy(update={"title": adjustment.new_title, "source": "user"})

    elif adjustment.action == "relevel" and adjustment.new_level is not None:
        template_levels = preview.template_levels
        new_level = max(0, min(adjustment.new_level, len(template_levels) - 1))
        nodes[idx] = target.model_copy(
            update={
                "level": new_level,
                "level_type": _level_type(template_levels, new_level),
                "source": "user",
                "confidence": 1.0,
            }
        )

    elif adjustment.action == "merge_up":
        # Into the previous sibling: a scene's prose joins the scene before; a chapter's scenes
        # move under the chapter before, which takes none of their prose itself.
        prev_idx = _previous_sibling(nodes, idx)
        if prev_idx is None or (target.word_count and prev_idx < idx - 1):
            return preview  # nothing before it, or its prose would swallow the nodes between
        prev = nodes[prev_idx]
        update: dict = {"source": "user"}
        if target.word_count:
            update |= {
                "word_count": prev.word_count + target.word_count,
                "content_preview": (prev.content_preview + " " + target.content_preview).strip()[:200],
                "paragraph_end": max(prev.paragraph_end, target.paragraph_end),
            }
        nodes[prev_idx] = prev.model_copy(update=update)
        nodes.pop(idx)

    return preview.model_copy(update={"nodes": _reassign_parents(nodes)})


def _reassign_parents(nodes: list[PreviewNode]) -> list[PreviewNode]:
    """Recompute parent_id for all nodes based on their levels."""
    level_stack: dict[int, str] = {}
    result: list[PreviewNode] = []

    for node in nodes:
        parent_id: str | None = None
        for lvl in range(node.level - 1, -1, -1):
            if lvl in level_stack:
                parent_id = level_stack[lvl]
                break

        level_stack[node.level] = node.id
        for lvl in list(level_stack.keys()):
            if lvl > node.level:
                del level_stack[lvl]

        result.append(node.model_copy(update={"parent_id": parent_id}))

    return result
