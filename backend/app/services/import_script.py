"""
A script file opened as a new screenplay story (doc 25, P6), through the same import wizard as a
manuscript: upload, review the structure, choose the Lorebook entries, create.

A Fountain (.fountain, .spmd) or Final Draft (.fdx) file says what each line is, so nothing is
guessed: each scene heading starts a scene, "#" and "##" sections (Final Draft's New Act) are
acts and sequences, the characters are the names in the cues (anyone who speaks twice or more),
and the places are the ones the headings name. A synopsis goes to the scene (or act) it is
written in, a note to the words it is written beside. The words themselves come in exactly as
written, each line as its element.
"""

from __future__ import annotations

import os
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from html import escape

from sqlalchemy.orm import Session

from ..models.note import Note
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.import_extraction import ExtractionCandidate, ExtractionOptions
from ..schemas.import_schemas import ImportPreviewTree, ParsedParagraph, PreviewNode
from ..schemas.story import TitlePage
from . import fdx, fountain
from .dialogue_service import sync_story_dialogue
from .import_service import _Section, build_preview_tree
from .script_scene import derive_heading, scene_title
from .script_source import Block, SceneNote, Section, Synopsis
from .script_syntax import heading_at, parse_cue, parse_slugline
from .word_count import recount_story

SCRIPT_EXTENSIONS = {".fountain", ".spmd", ".fdx"}

#: A character is someone who speaks this often; a one-line WAITER stays in the script alone.
MIN_CUES = 2


def is_script_file(filename: str) -> bool:
    return os.path.splitext(filename)[1].lower() in SCRIPT_EXTENSIONS


@dataclass
class ScriptImport:
    """What a script import keeps beside its paragraphs, between the wizard's steps."""

    #: Each paragraph's element ("section" for an act or sequence), by paragraph index.
    elements: list[str]
    title_page: dict[str, str]
    author: str
    notes: dict[str, tuple[str, str]]
    #: Synopses and scene notes by the paragraph they follow: the scene holding it takes them.
    synopses: dict[int, list[str]] = field(default_factory=lambda: defaultdict(list))
    scene_notes: dict[int, list[str]] = field(default_factory=lambda: defaultdict(list))


def _decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


def read_script(data: bytes, filename: str) -> tuple[list[ParsedParagraph], str | None, str, ScriptImport]:
    """A script file as the wizard's paragraphs: (paragraphs, title, format, the rest).
    Raises ValueError for a file that is not one."""
    is_fdx = filename.lower().endswith(".fdx")
    src = fdx.parse(data) if is_fdx else fountain.parse(_decode(data))
    imp = ScriptImport(elements=[], title_page=src.page, author=src.author, notes=src.notes)
    paragraphs: list[ParsedParagraph] = []
    waiting: list[Synopsis | SceneNote] = []

    def add(html: str, text: str, tag: str, element: str) -> None:
        index = len(paragraphs)
        paragraphs.append(
            ParsedParagraph(index=index, html=html, text_preview=text[:120], tag=tag, word_count=len(text.split()))
        )
        imp.elements.append(element)
        for item in waiting:
            _keep(imp, index, item)
        waiting.clear()

    for item in _sections_first(src.items):
        if isinstance(item, Section):
            tag = f"h{min(item.depth, 3)}"
            add(f"<{tag}>{escape(item.title, quote=False)}</{tag}>", item.title, tag, "section")
        elif isinstance(item, Block):
            dual = ' data-dual="true"' if item.dual else ""
            add(f'<p data-el="{item.element}"{dual}>{item.html}</p>', item.text, "p", item.element)
        elif paragraphs:
            _keep(imp, len(paragraphs) - 1, item)
        else:
            waiting.append(item)
    if not any(e != "section" for e in imp.elements):
        raise ValueError("There is no script in this file.")
    return paragraphs, src.title or None, "fdx" if is_fdx else "fountain", imp


def _opens(item) -> bool:
    """A line that opens a script ("FADE IN:")."""
    return isinstance(item, Block) and heading_at([(item.element, item.text)]) == 1


def _sections_first(items: list) -> list:
    """An act marked just after the script's "FADE IN:" opens before it: the opening line stays
    with the first scene."""
    out: list = []
    for item in items:
        at = len(out)
        if isinstance(item, Section):
            while at and _opens(out[at - 1]):
                at -= 1
        out.insert(at, item)
    return out


def _keep(imp: ScriptImport, index: int, item: Synopsis | SceneNote) -> None:
    (imp.synopses if isinstance(item, Synopsis) else imp.scene_notes)[index].append(item.text)


def script_preview(
    imp: ScriptImport,
    paragraphs: list[ParsedParagraph],
    *,
    session_id: str,
    template_id: str,
    template_levels: list[dict],
    source_format: str,
    detected_title: str | None,
) -> ImportPreviewTree:
    """The structure the file states: a scene at each heading, under its act or sequence. A
    section deeper than the structure has levels for joins the level above the scenes."""
    leaf = len(template_levels) - 1
    sections: list[_Section] = []
    scene: _Section | None = None
    for para in paragraphs:
        element = imp.elements[para.index]
        if element == "section":
            if leaf > 0:
                sections.append(_Section(min(int(para.tag[1]) - 1, leaf - 1), "heuristic", 1.0, title_para=para))
            scene = None
            continue
        # A heading starts the next scene, unless all before it is the script's "FADE IN:".
        opening = scene is not None and all(_opens_para(p, imp) for p in scene.content_paras)
        if scene is None or (element == "heading" and not opening):
            scene = _Section(leaf, "heuristic", 1.0)
            sections.append(scene)
        scene.content_paras.append(para)
    preview = build_preview_tree(
        sections=sections,
        paragraphs=paragraphs,
        session_id=session_id,
        template_id=template_id,
        template_levels=template_levels,
        source_format=source_format,
        detected_title=detected_title,
    )
    nodes = [_named(n, paragraphs, imp) if n.level == leaf else n for n in preview.nodes]
    return preview.model_copy(update={"nodes": nodes, "warnings": []})


def _opens_para(para: ParsedParagraph, imp: ScriptImport) -> bool:
    return heading_at([(imp.elements[para.index], para.text_preview)]) == 1


def _named(node: PreviewNode, paragraphs: list[ParsedParagraph], imp: ScriptImport) -> PreviewNode:
    scene = paragraphs[node.paragraph_start : node.paragraph_end + 1]
    at = node.paragraph_start + heading_at([(imp.elements[p.index], p.text_preview) for p in scene])
    if at > node.paragraph_end or imp.elements[at] != "heading":
        return node.model_copy(update={"title": "Opening", "needs_review": False})
    slug = parse_slugline(paragraphs[at].text_preview)
    return node.model_copy(update={"title": scene_title(slug), "needs_review": False})


def _scene_of(nodes: list[PreviewNode]) -> dict[int, str]:
    """Each paragraph's scene: the deepest node holding it."""
    out: dict[int, str] = {}
    for node in sorted(nodes, key=lambda n: n.level):
        for i in range(node.paragraph_start, node.paragraph_end + 1):
            out[i] = node.id
    return out


def candidates(
    imp: ScriptImport, paragraphs: list[ParsedParagraph], nodes: list[PreviewNode], options: ExtractionOptions
) -> list[ExtractionCandidate]:
    """The Lorebook entries the script names: who speaks (in its cues) and where (in its headings)."""
    scene_of = _scene_of(nodes)
    seen: dict[str, Counter] = {"character": Counter(), "location": Counter()}
    scenes: dict[tuple[str, str], set[str]] = defaultdict(set)
    for para in paragraphs:
        element = imp.elements[para.index]
        if element == "cue" and options.characters_nlp:
            kind, name = "character", _person(parse_cue(para.text_preview).name)
        elif element == "heading" and options.locations_nlp:
            kind, name = "location", _place(parse_slugline(para.text_preview).place)
        else:
            continue
        if name:
            seen[kind][name] += 1
            scenes[(kind, name)].add(scene_of.get(para.index, ""))
    out = []
    for kind in ("character", "location"):
        for name, n in seen[kind].most_common():
            if kind == "character" and n < MIN_CUES:
                continue
            ids = sorted(s for s in scenes[(kind, name)] if s)
            out.append(
                ExtractionCandidate(
                    id=str(uuid.uuid4()),
                    name=name,
                    entity_type=kind,
                    source="nlp",
                    occurrences=n,
                    scene_count=len(ids),
                    confidence=1.0,
                    scene_ids=ids,
                )
            )
    return out


def _person(cue: str) -> str:
    """A cue as a name: "MRS. HALE" is Mrs. Hale; a name with its own capitals (McCLANE) stays."""
    name = cue.lstrip("@").strip()
    return name if any(c.islower() for c in name) else name.title()


def _place(place: str) -> str:
    return " ".join(w[:1].upper() + w[1:] for w in place.lower().split())


def _by_preview(story_id: str, preview: ImportPreviewTree, db: Session) -> dict[str, StructureNode]:
    """The story's nodes by the preview node each was made from (made in order, by position)."""
    children: dict[str | None, list[StructureNode]] = defaultdict(list)
    for node in db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position):
        children[node.parent_id].append(node)
    out: dict[str, StructureNode] = {}
    used: Counter = Counter()
    for p in preview.nodes:
        parent = out[p.parent_id].id if p.parent_id in out else None
        out[p.id] = children[parent][used[parent]]
        used[parent] += 1
    return out


def finish(story: Story, imp: ScriptImport, preview: ImportPreviewTree, db: Session) -> None:
    """Make the new story a screenplay: its title page, the synopses and notes where they were
    written, each scene's heading read, its pages counted and its speeches read."""
    story.story_format = "screenplay"
    story.title_page = TitlePage(**imp.title_page).model_dump()
    if imp.author and not story.author_name:
        story.author_name = imp.author
    nodes = _by_preview(story.id, preview, db)
    scene_of = _scene_of(preview.nodes)
    synopses: dict[str, list[str]] = defaultdict(list)
    for index, texts in imp.synopses.items():
        synopses[scene_of[index]] += texts
    for pid, texts in synopses.items():
        nodes[pid].synopsis = " ".join(texts)
    for index, texts in imp.scene_notes.items():
        for text in texts:
            db.add(Note(story_id=story.id, node_id=nodes[scene_of[index]].id, content=text))
    for node in nodes.values():
        for note_id in imp.notes:
            if f'data-note-id="{note_id}"' in (node.content or ""):
                content, anchor = imp.notes[note_id]
                db.add(Note(id=note_id, story_id=story.id, node_id=node.id, content=content, anchor=anchor))
        derive_heading(node, story, db)
    db.flush()
    recount_story(story.id, db)
    db.commit()
    sync_story_dialogue(story.id, db)
