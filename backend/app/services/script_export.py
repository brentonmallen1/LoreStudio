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

from pydantic import BaseModel

from ..models.story import Story
from ..schemas.story import TitlePage
from .manuscript_builder import ManuscriptSection
from .script_syntax import parse_cue, scene_blocks

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


@dataclass
class ScriptDoc:
    title: str
    author: str
    page: TitlePage
    blocks: list[Block] = field(default_factory=list)

    @property
    def pairs(self) -> list[tuple[str, str]]:
        """The blocks as the paginator reads them."""
        return [(b.element, b.text) for b in self.blocks]


def title_page_of(story: Story) -> TitlePage:
    return TitlePage.model_validate(story.title_page or {})


def build_script(story: Story, sections: list[ManuscriptSection], *, auto_contd: bool = True) -> ScriptDoc:
    """The story's scenes as one script. Acts and sequences are the outline's, not the page's:
    a feature script prints none of them."""
    blocks: list[Block] = []
    number = 0
    for section in sections:
        if not section.is_leaf or not section.content:
            continue
        for element, text in scene_blocks(section.content):
            if not text.strip():
                continue
            if element == "heading":
                number += 1
                blocks.append(Block(element, text, number))
            else:
                blocks.append(Block(element, text))
    if auto_contd:
        _continued(blocks)
    return ScriptDoc(
        title=story.title or "Untitled", author=story.author_name or "", page=title_page_of(story), blocks=blocks
    )


def _continued(blocks: list[Block]) -> None:
    """A speaker who speaks again with only action since gets "(CONT'D)" on the cue."""
    last: str | None = None
    for block in blocks:
        if block.element in ("heading", "transition"):
            last = None
        elif block.element == "cue":
            cue = parse_cue(block.text)
            if cue.name == last and not any(e.upper() in ("CONT'D", "CONT’D", "CONT") for e in cue.extensions):
                block.text = f"{block.text} (CONT'D)"
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
