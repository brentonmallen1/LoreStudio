"""The import wizard's Novelcrafter path (doc 28): open the export, show it, make it.

The manuscript goes through the wizard's own steps (pandoc, headings and breaks, the
structure review); the rest is held beside it until finalize.
"""

from __future__ import annotations

import html
import io
import re
import zipfile
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ...models.import_record import ImportRecord
from ...models.story import Story
from ...models.structure import StructureNode
from ...schemas.import_novelcrafter import LeftOut, NovelcrafterChoices, NovelcrafterPreview
from ...schemas.import_schemas import ImportPreviewTree, ParsedParagraph
from .. import import_records
from ..import_script import ScriptImport
from ..import_service import parse_document
from ..script_scene import scene_title
from ..script_syntax import parse_slugline
from .create import create_from_export
from .mapping import NOT_IN_FILE, left_out, propose, resolve
from .reader import Export, read_export
from .screenplay import as_script, looks_like_screenplay

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#: The structure a Novelcrafter manuscript has: acts (Heading 1), chapters (Heading 2), and
#: scenes between its "* * *" breaks. Used when the author left the template at its default.
TEMPLATE = "three-act"

#: "Chapter 1: Scene 1: Lay of the Land": Novelcrafter's numbering, before the scene's name.
_PREFIX = re.compile(r"^(?:(?:act|part|book|chapter|scene)\s+[\w.]+\s*[:.\-–—]\s*)+", re.IGNORECASE)
_CREATOR = re.compile(r"<dc:creator>([^<]*)</dc:creator>")


@dataclass
class NovelcrafterImport:
    export: Export
    preview: NovelcrafterPreview
    author: str | None


def strip_scene_prefix(title: str) -> str:
    title = " ".join(title.split())  # a heading pandoc wrapped onto two lines
    rest = _PREFIX.sub("", title).strip()
    return rest or title


def retitle(tree: ImportPreviewTree) -> ImportPreviewTree:
    """Each heading without Novelcrafter's numbering: LoreStudio numbers chapters itself."""
    for node in tree.nodes:
        node.title = strip_scene_prefix(node.title)
    return tree


def docx_author(docx: bytes) -> str | None:
    try:
        with zipfile.ZipFile(io.BytesIO(docx)) as zf:
            core = zf.read("docProps/core.xml").decode("utf-8", errors="replace")
    except (KeyError, zipfile.BadZipFile):
        return None
    m = _CREATOR.search(core)
    return m.group(1).strip() or None if m else None


def open_export(data: bytes) -> tuple[list[ParsedParagraph], str | None, NovelcrafterImport]:
    """The manuscript's paragraphs and title, and everything else held for the later steps.
    Raises ValueError (NotAnExport) for a file it cannot read."""
    export = read_export(data)
    paragraphs, title, _ = parse_document(export.docx, "novel.docx", DOCX)
    author = docx_author(export.docx)
    preview = propose(export, looks_like_screenplay=looks_like_screenplay(paragraphs), author=author)
    return paragraphs, title, NovelcrafterImport(export=export, preview=preview, author=author)


def as_script_import(
    paragraphs: list[ParsedParagraph], author: str | None
) -> tuple[list[ParsedParagraph], ScriptImport]:
    """The manuscript typed as a screenplay, with what ``import_script.finish`` needs."""
    typed, elements = as_script(paragraphs)
    return typed, ScriptImport(elements=elements, title_page={}, author=author or "", notes={})


_HEADING_TEXT = re.compile(r'<p data-el="heading">([^<]*)</p>')


def name_scenes(story: Story, db: Session) -> None:
    """A scene the import could only call "Untitled", named for the place its heading names,
    as a script import names every scene (doc 25, P6)."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()
    for node in nodes:
        m = _HEADING_TEXT.search(node.content or "")
        if m and (node.title or "").startswith("Untitled"):
            node.title = scene_title(parse_slugline(html.unescape(m.group(1))))
    db.flush()


def finish(
    story: Story,
    nc: NovelcrafterImport,
    choices: NovelcrafterChoices,
    *,
    filename: str,
    data: bytes,
    user_id: str,
    db: Session,
) -> ImportRecord:
    """The Lorebook, notes and conversations made in ``story``, and the record of it all."""
    entries, snippets = resolve(nc.preview, choices)
    record = import_records.start(story, source="novelcrafter", filename=filename, data=data, user_id=user_id, db=db)
    if nc.author and not story.author_name:
        story.author_name = nc.author
    create_from_export(
        nc.export, entries, snippets, chats=choices.chats, story=story, user_id=user_id, record=record, db=db
    )
    import_records.manuscript(record, story, db)
    if choices.screenplay:
        name_scenes(story, db)
    no_place, nothing = left_out(nc.export, entries)
    if nc.export.chats and not choices.chats:
        n = len(nc.export.chats)
        no_place.append(
            LeftOut(
                what=f"{n} AI {'conversation' if n == 1 else 'conversations'}",
                why="Not brought into the Chronicle. They are in the original file.",
                count=n,
            )
        )
    record.left_out = [x.model_dump() for x in no_place]
    record.nothing_set = nothing
    record.not_in_file = NOT_IN_FILE
    db.commit()
    return record
