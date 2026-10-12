"""
A screenplay as it is handed on (doc 25, P3): one document every script export reads.

The story's scenes in reading order become one run of (element, text) blocks, with each
heading's scene number and, as Final Draft does by default, "(CONT'D)" on a cue when the same
character speaks again with only action between. The title page is the story's title and byline
plus `stories.title_page`. The PDF (`script_pdf`), Fountain (`fountain`) and Final Draft
(`fdx`) writers all start here, so they agree on every line.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from ..models.story import Story
from ..schemas.story import TitlePage
from .manuscript_builder import ManuscriptSection
from .script_syntax import parse_cue, scene_blocks, shown_cue
from .story_format import story_format

#: A script export: what it is called, its media type, its file extension.
SCRIPT_FORMATS: dict[str, tuple[str, str]] = {
    "screenplay_pdf": ("application/pdf", "pdf"),
    "fountain": ("text/plain; charset=utf-8", "fountain"),
    "fdx": ("application/xml; charset=utf-8", "fdx"),
}


class ScriptOptions(BaseModel):
    """The choices a script export offers (doc 25, export layout spec)."""

    title_page: bool = True
    #: A shooting script numbers its scenes in both margins.
    scene_numbers: bool = False
    bold_headings: bool = False
    page_size: str = "letter"
    #: "(CONT'D)" on a cue when the same character speaks again with only action between.
    auto_contd: bool = True


@dataclass
class Block:
    element: str
    text: str
    #: A heading's scene number, counting from 1.
    number: int | None = None
    #: A TV script's act line (doc 25, P11): "open" (its title, on a new page) or "close"
    #: ("END OF …"); a centred line to every writer that has no act of its own.
    act: str = ""

    @property
    def new_page(self) -> bool:
        return self.act == "open"


@dataclass
class ScriptDoc:
    title: str
    author: str
    page: TitlePage
    blocks: list[Block] = field(default_factory=list)
    #: "screenplay" or "stage_play": which page layout it prints with (doc 25, P9).
    format: str = "screenplay"

    @property
    def pairs(self) -> list[tuple[str, str]]:
        """The blocks as the paginator reads them."""
        return [(b.element, b.text) for b in self.blocks]

    @property
    def turns(self) -> set[int]:
        """The blocks that start a new page."""
        return {i for i, b in enumerate(self.blocks) if b.new_page}


def title_page_of(story: Story) -> TitlePage:
    return TitlePage.model_validate(story.title_page or {})


#: The forms whose scripts print their acts (doc 25, P11): a TV script opens each act on a new
#: page with its title and closes it with "END OF …"; a feature prints none of them.
TV_FORMS = ("tv_half_hour", "tv_hour")


def prints_acts(story: Any) -> bool:
    return story_format(story) == "screenplay" and (getattr(story, "intended_length", None) or "") in TV_FORMS


def script_blocks(scenes: list[tuple[str | None, str | None]]) -> list[Block]:
    """Scenes as (the act they are in, or None, and their stored HTML), in reading order, as one
    run of blocks: scene numbers on the headings, and an act's title and its "END OF" around
    its scenes when it has one. An act with nothing written prints nothing."""
    blocks: list[Block] = []
    number = 0
    act: str | None = None
    for title, html in scenes:
        for element, text in scene_blocks(html or ""):
            if not text.strip():
                continue
            if title != act:
                if act:
                    blocks.append(Block("centered", f"END OF {act.upper()}", act="close"))
                if title:
                    blocks.append(Block("centered", title.upper(), act="open"))
                act = title
            if element == "heading":
                number += 1
                blocks.append(Block(element, text, number))
            else:
                blocks.append(Block(element, text))
    if act:
        blocks.append(Block("centered", f"END OF {act.upper()}", act="close"))
    return blocks


def section_acts(sections: list[ManuscriptSection]) -> list[str | None]:
    """Each leaf section's act: the title of the outline's top level above it."""
    out: list[str | None] = []
    act: str | None = None
    for section in sections:
        if section.level == 1:
            act = None if section.is_leaf else (section.heading or "").strip() or None
        if section.is_leaf:
            out.append(act)
    return out


def node_acts(leaves: list[Any], by_id: dict[str, Any]) -> list[str | None]:
    """Each leaf's act, from rows with ``id``, ``parent_id`` and ``title``: the title of its
    top-level ancestor (None for a leaf at the top)."""
    out: list[str | None] = []
    for leaf in leaves:
        top = leaf
        while top.parent_id and top.parent_id in by_id:
            top = by_id[top.parent_id]
        out.append(None if top is leaf else (top.title or "").strip() or None)
    return out


def build_script(story: Story, sections: list[ManuscriptSection], *, auto_contd: bool = True) -> ScriptDoc:
    """The story's scenes as one script. Acts and sequences are the outline's, not the page's,
    except in a TV script, which prints its acts."""
    leaves = [s for s in sections if s.is_leaf]
    acts = section_acts(sections) if prints_acts(story) else [None] * len(leaves)
    blocks = script_blocks([(act, s.content) for act, s in zip(acts, leaves, strict=True)])
    if auto_contd:
        _continued(blocks)
    return ScriptDoc(
        title=story.title or "Untitled",
        author=story.author_name or "",
        page=title_page_of(story),
        blocks=blocks,
        format=story_format(story),
    )


def pages_in(contents: list[str | None], fmt: str | None = None, acts: list[str | None] | None = None) -> int:
    """How many pages scenes with these contents, in this order, print on in their format: the
    PDF's count, title page aside (doc 25, D5). `acts`, one per scene, for a TV script."""
    from .script_syntax import page_count

    blocks = script_blocks(list(zip(acts or [None] * len(contents), contents, strict=True)))
    _continued(blocks)
    return page_count([(b.element, b.text) for b in blocks], fmt, {i for i, b in enumerate(blocks) if b.new_page})


def leaves_pages(story: Any, leaves: list[Any], by_id: dict[str, Any]) -> int:
    """`pages_in` for a story's leaves in reading order (rows with ``content``, ``parent_id`` and
    ``title``), with a TV script's acts."""
    acts = node_acts(leaves, by_id) if prints_acts(story) else None
    return pages_in([n.content for n in leaves], story_format(story), acts)


def _continued(blocks: list[Block]) -> None:
    """A speaker who speaks again with only action since gets "(CONT'D)" on the cue."""
    last: str | None = None
    for block in blocks:
        if block.element in ("heading", "transition"):
            last = None
        elif block.element == "cue":
            cue = parse_cue(block.text)
            if cue.name == last and not any(e.upper() in ("CONT'D", "CONT’D", "CONT") for e in cue.extensions):
                # Before a dual mark, which ends the cue (doc 25, P8).
                block.text = f"{shown_cue(block.text)} (CONT'D)" + (" ^" if cue.dual else "")
            last = cue.name


def export_script(story: Story, sections: list[ManuscriptSection], fmt: str, options: ScriptOptions) -> bytes:
    """The script in one of `SCRIPT_FORMATS`."""
    from . import fdx, fountain, script_pdf  # each reads ScriptDoc from here

    doc = build_script(story, sections, auto_contd=options.auto_contd)
    if fmt == "fountain":
        return fountain.to_fountain(doc, options).encode("utf-8")
    if fmt == "fdx":
        return fdx.to_fdx(doc, options).encode("utf-8")
    return script_pdf.render_pdf(doc, options)
