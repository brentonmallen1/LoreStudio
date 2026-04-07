"""
Manuscript builder — assembles the StructureNode tree into a readable HTML document
suitable for pandoc conversion or direct in-browser rendering.

Content is stored as TipTap HTML so we use --from html for pandoc input.
"""

import re
from dataclasses import dataclass
from html import escape
from typing import Optional

from sqlalchemy.orm import Session

from ..models.structure import StructureNode
from ..models.story import Story


def _clean_mentions(html: str) -> str:
    """Strip inline mention syntax from TipTap HTML before manuscript rendering.

    [[Setting Name]] → Setting Name
    "dialogue"<Name> → "dialogue"  (strip speaker suffix)
    @CharacterName   → CharacterName
    """
    html = re.sub(r'\[\[([^\]]+)\]\]', r'\1', html)
    # Remove explicit dialogue speaker suffix stored as entity-encoded angle brackets:
    # "..."&lt;Name&gt; → "..."  (TipTap stores < and > as &lt; and &gt; in HTML)
    html = re.sub(r'([\u201d"])&lt;([^&]+)&gt;', r'\1', html)
    # Negative lookbehind avoids matching email addresses (foo@bar.com)
    html = re.sub(r'(?<!\w)@([A-Za-z]\S*)', r'\1', html)
    return html


@dataclass
class ManuscriptSection:
    id: str
    heading: str
    level: int          # heading depth: 1=root act, 2=chapter, 3=scene…
    is_leaf: bool
    content: Optional[str]   # TipTap HTML, or None for container nodes
    word_count: int
    status: str


def _walk_tree(
    nodes: list[StructureNode],
    children_map: dict[str, list[StructureNode]],
    heading_level: int,
    sections: list[ManuscriptSection],
    status_filter: Optional[list[str]],
) -> None:
    for node in sorted(nodes, key=lambda n: n.position):
        kids = children_map.get(node.id, [])
        is_leaf = len(kids) == 0

        if is_leaf:
            if status_filter and node.status not in status_filter:
                continue
            sections.append(ManuscriptSection(
                id=node.id,
                heading=node.title or "Untitled",
                level=heading_level,
                is_leaf=True,
                content=_clean_mentions(node.content or ""),
                word_count=node.word_count or 0,
                status=node.status or "draft",
            ))
        else:
            sections.append(ManuscriptSection(
                id=node.id,
                heading=node.title or "Untitled",
                level=heading_level,
                is_leaf=False,
                content=None,
                word_count=0,
                status="",
            ))
            _walk_tree(kids, children_map, heading_level + 1, sections, status_filter)


def get_manuscript_sections(
    story: Story,
    db: Session,
    status_filter: Optional[list[str]] = None,
) -> list[ManuscriptSection]:
    """Return ordered sections (headings + leaf scenes) for the full manuscript."""
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()

    children_map: dict[str, list[StructureNode]] = {}
    roots: list[StructureNode] = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    sections: list[ManuscriptSection] = []
    _walk_tree(
        sorted(roots, key=lambda n: n.position),
        children_map,
        heading_level=1,
        sections=sections,
        status_filter=status_filter,
    )
    return sections


def build_manuscript_html(
    story: Story,
    sections: list[ManuscriptSection],
    *,
    include_headers: bool = True,
    include_scene_titles: bool = False,
    title_page: bool = True,
    scene_break: str = "* * *",
) -> str:
    """
    Build a complete HTML document from manuscript sections.

    Pandoc converts this with --from html to docx/epub/odt/markdown/html.
    Scene breaks are rendered as centered paragraphs so pandoc preserves them
    as text (rather than converting <hr> to a rule, which loses the character).
    """
    parts: list[str] = []

    title_text = escape(story.title or "Untitled")

    parts.append(
        f'<!DOCTYPE html>\n<html lang="en">\n'
        f"<head><meta charset=\"utf-8\"><title>{title_text}</title></head>\n"
        f"<body>\n"
    )

    if title_page:
        parts.append(f'<h1 class="title">{title_text}</h1>\n')

    prev_was_leaf = False

    for section in sections:
        if section.is_leaf:
            # Scene break between consecutive scenes
            if prev_was_leaf:
                break_text = escape(scene_break)
                parts.append(
                    f'<p style="text-align:center" class="scene-break">{break_text}</p>\n'
                )

            if include_scene_titles:
                h = min(section.level + 1, 6)
                parts.append(f"<h{h}>{escape(section.heading)}</h{h}>\n")

            if section.content:
                parts.append(section.content)
                parts.append("\n")

            prev_was_leaf = True
        else:
            if include_headers:
                h = min(section.level, 6)
                parts.append(f"\n<h{h}>{escape(section.heading)}</h{h}>\n")
            prev_was_leaf = False

    parts.append("\n</body>\n</html>")
    return "".join(parts)
