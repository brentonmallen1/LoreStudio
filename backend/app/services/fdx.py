"""
Final Draft's .fdx, written out (doc 25, P3): writers hand scripts on in Final Draft.

An FDX file is XML: one `<Paragraph Type="…">` per element, which Final Draft (and Fade In,
WriterDuet, Highland) lays out with its own standard settings for each type. A line break inside
a block becomes the next paragraph of the same type.

`parse` reads one for import (doc 25, P6): the elements, Final Draft's own italics and bold, a
scene's summary as its synopsis, script notes as margin notes, and the title page.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from xml.sax.saxutils import escape, quoteattr

from .script_export import ScriptDoc, ScriptOptions
from .script_source import ScriptSource, Section, Synopsis
from .script_syntax import CAPITALS, SCENE_NUMBER

TYPES = {
    "heading": "Scene Heading",
    "action": "Action",
    "cue": "Character",
    "paren": "Parenthetical",
    "dialogue": "Dialogue",
    "transition": "Transition",
}


def _para(kind: str, text: str, extra: str = "") -> str:
    return f"    <Paragraph Type={quoteattr(kind)}{extra}>\n      <Text>{escape(text)}</Text>\n    </Paragraph>"


def _title_para(text: str, align: str) -> str:
    return f'      <Paragraph Alignment={quoteattr(align)} Type="Text">\n        <Text>{escape(text)}</Text>\n      </Paragraph>'


def _title_page(doc: ScriptDoc) -> list[str]:
    page = doc.page
    centre = ["", "", "", "", "", "", "", "", "", "", doc.title.upper(), ""]
    if doc.author:
        centre += [page.credit, "", doc.author]
    if page.based_on.strip():
        centre += ["", *page.based_on.strip().split("\n")]
    lines = [_title_para(t, "Center") for t in centre]
    lines += [_title_para("", "Left") for _ in range(12)]
    lines += [_title_para(t.strip(), "Left") for t in page.contact.strip().split("\n") if t.strip()]
    lines += [_title_para(t.strip(), "Right") for t in (page.draft, page.date) if t.strip()]
    return ["  <TitlePage>", "    <Content>", *lines, "    </Content>", "  </TitlePage>"]


def to_fdx(doc: ScriptDoc, options: ScriptOptions) -> str:
    paras: list[str] = []
    for block in doc.blocks:
        kind = TYPES.get(block.element, "Action")
        for i, line in enumerate(block.text.split("\n")):
            extra = f' Number="{block.number}"' if options.scene_numbers and block.number and i == 0 else ""
            paras.append(_para(kind, line, extra))
    out = [
        '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
        '<FinalDraft DocumentType="Script" Template="No" Version="5">',
        "  <Content>",
        *paras,
        "  </Content>",
    ]
    if options.title_page:
        out += _title_page(doc)
    out.append("</FinalDraft>")
    return "\n".join(out) + "\n"


# ── Reading a file (doc 25, P6) ──────────────────────────────────────────────────────────

ELEMENTS = {kind: element for element, kind in TYPES.items()}
#: Final Draft's other paragraph types that open an act; the rest ("Shot", "General"…) are action.
_ACTS = ("New Act",)
_SKIP = ("End of Act", "Cast List")
_CREDIT = re.compile(r"^((written|story|screenplay|teleplay)\s+)?by\b", re.I)


@dataclass
class _Para:
    element: str
    runs: list[tuple[str, str]]
    notes: list[str]
    synopsis: str


def _trim(runs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    if runs:
        runs[0] = (runs[0][0].lstrip(), runs[0][1])
        runs[-1] = (runs[-1][0].rstrip(), runs[-1][1])
    return [r for r in runs if r[0]]


def _style(text_el: ET.Element) -> str:
    style = text_el.get("Style", "")
    return " ".join(s for s, word in (("em", "Italic"), ("strong", "Bold")) if word in style)


def _runs(para: ET.Element) -> list[tuple[str, str]]:
    return [(t.text or "", _style(t)) for t in para.findall("Text") if t.text]


def _words(para: ET.Element) -> str:
    return "".join(t for t, _ in _runs(para)).strip()


def _notes(para: ET.Element) -> list[str]:
    out = []
    for note in para.iter("ScriptNote"):
        text = " ".join(_words(p) for p in note.iter("Paragraph"))
        if text.strip():
            out.append(text.strip())
    return out


def _paragraphs(content: ET.Element):
    """The script's paragraphs in order, a dual dialogue's two speeches one after the other."""
    for para in content.findall("Paragraph"):
        dual = para.find("DualDialogue")
        if dual is not None:
            yield from dual.findall("Paragraph")
        else:
            yield para


def _read_title_page(root: ET.Element, src: ScriptSource) -> None:
    lines: dict[str, list[str]] = {"Center": [], "Left": [], "Right": []}
    for para in root.findall("./TitlePage/Content/Paragraph"):
        words = _words(para)
        if words:
            lines.setdefault(para.get("Alignment", "Left"), []).append(words)
    centre = lines["Center"]
    if centre:
        src.title = centre.pop(0)
    if centre and _CREDIT.match(centre[0]):
        src.page["credit"] = centre.pop(0)
        if centre:
            src.author = centre.pop(0)
    if centre:
        src.page["based_on"] = "\n".join(centre)
    if lines["Left"]:
        src.page["contact"] = "\n".join(lines["Left"])
    right = lines["Right"]
    if len(right) == 1 and not re.search(r"\d", right[0]):
        src.page["draft"] = right[0]
    elif right:
        src.page["date"] = right[-1]
        if len(right) > 1:
            src.page["draft"] = " ".join(right[:-1])


def parse(data: bytes) -> ScriptSource:
    """A Final Draft file, read. A file that declares its own entities is refused unread."""
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("This Final Draft file declares a document type, which LoreStudio does not read.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise ValueError(f"This is not a Final Draft file LoreStudio can read ({e}).") from e
    src = ScriptSource()
    content = root.find("Content")
    if root.tag != "FinalDraft" or content is None:
        raise ValueError("This is not a Final Draft file LoreStudio can read.")
    _read_title_page(root, src)
    read: list[Section | _Para] = []
    for para in _paragraphs(content):
        kind = para.get("Type", "Action")
        if kind in _ACTS and _words(para):
            read.append(Section(1, _words(para)))
        if kind in _ACTS or kind in _SKIP or not _words(para):
            continue
        element = ELEMENTS.get(kind, "action")
        runs = _trim([(t.upper() if element in CAPITALS else t, s) for t, s in _runs(para)])
        if element == "heading":
            runs = [(SCENE_NUMBER.sub("", t), s) for t, s in runs]
        last = read[-1] if read else None
        if element == "dialogue" and isinstance(last, _Para) and last.element == "dialogue":
            # Final Draft breaks a speech into paragraphs; it is one block, its lines kept.
            last.runs += [("\n", ""), *runs]
            last.notes += _notes(para)
            continue
        summary = para.find("SceneProperties/Summary")
        synopsis = " ".join(_words(p) for p in summary.iter("Paragraph")).strip() if summary is not None else ""
        read.append(_Para(element, runs, _notes(para), synopsis))
    for item in read:
        if isinstance(item, Section):
            src.items.append(item)
            continue
        src.block(item.element, item.runs, item.notes)
        if item.synopsis:
            src.items.append(Synopsis(item.synopsis))
    return src
