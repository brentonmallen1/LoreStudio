"""
Final Draft's .fdx, written out (doc 25, P3): writers hand scripts on in Final Draft.

An FDX file is XML: one `<Paragraph Type="…">` per element, which Final Draft (and Fade In,
WriterDuet, Highland) lays out with its own standard settings for each type. A line break inside
a block becomes the next paragraph of the same type. Final Draft has no centred or lyric type: a
centred line is centred action, a lyric italic dialogue; two speeches at once sit inside one
`<DualDialogue>` (doc 25, P8).

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
from .script_syntax import CAPITALS, SCENE_NUMBER, SPEECH, parse_cue, shown_cue

TYPES = {
    "heading": "Scene Heading",
    "action": "Action",
    "cue": "Character",
    "paren": "Parenthetical",
    "dialogue": "Dialogue",
    "transition": "Transition",
    "centered": "Action",
    "lyric": "Dialogue",
}


def _para(kind: str, text: str, extra: str = "", style: str = "") -> str:
    styled = f" Style={quoteattr(style)}" if style else ""
    return f"    <Paragraph Type={quoteattr(kind)}{extra}>\n      <Text{styled}>{escape(text)}</Text>\n    </Paragraph>"


def _block_paras(block, options: ScriptOptions) -> list[str]:
    kind = TYPES.get(block.element, "Action")
    text = shown_cue(block.text) if block.element == "cue" else block.text
    extra = ' Alignment="Center"' if block.element == "centered" else ""
    style = "Italic" if block.element == "lyric" else ""
    out = []
    for i, line in enumerate(text.split("\n")):
        number = f' Number="{block.number}"' if options.scene_numbers and block.number and i == 0 else ""
        out.append(_para(kind, line, number + extra, style))
    return out


def _units(blocks) -> list[list]:
    """The blocks grouped: a speech (a cue and what it says) is one unit, any other block one."""
    out: list[list] = []
    for block in blocks:
        if block.element in SPEECH and out and out[-1][0].element == "cue":
            out[-1].append(block)
        else:
            out.append([block])
    return out


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
    units = _units(doc.blocks)
    for k, unit in enumerate(units):
        dual = unit[0].element == "cue" and parse_cue(unit[0].text).dual
        if dual and k and units[k - 1][0].element == "cue" and not parse_cue(units[k - 1][0].text).dual:
            continue  # written with the speech before it
        nxt = units[k + 1] if k + 1 < len(units) else None
        if unit[0].element == "cue" and nxt and nxt[0].element == "cue" and parse_cue(nxt[0].text).dual:
            inner = [p for b in unit + nxt for p in _block_paras(b, options)]
            paras.append(
                "    <Paragraph>\n      <DualDialogue>\n"
                + "\n".join(inner)
                + "\n      </DualDialogue>\n    </Paragraph>"
            )
            continue
        paras += [p for b in unit for p in _block_paras(b, options)]
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

ELEMENTS = {kind: element for element, kind in TYPES.items() if element not in ("centered", "lyric")}
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
    dual: bool = False


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
    """The script's paragraphs in order, as (paragraph, whether it is the cue of the second of
    two speeches at once): a dual dialogue's two speeches one after the other."""
    for para in content.findall("Paragraph"):
        dual = para.find("DualDialogue")
        if dual is None:
            yield para, False
            continue
        cues = 0
        for inner in dual.findall("Paragraph"):
            cues += inner.get("Type") == "Character"
            yield inner, inner.get("Type") == "Character" and cues == 2


def _element(para: ET.Element, kind: str) -> str:
    """A paragraph's element: a centred line of action is centred, all-italic dialogue a lyric."""
    element = ELEMENTS.get(kind, "action")
    if element == "action" and para.get("Alignment") == "Center":
        return "centered"
    runs = _runs(para)
    if element == "dialogue" and runs and all("em" in s for _, s in runs if _.strip()):
        return "lyric"
    return element


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
    for para, dual in _paragraphs(content):
        kind = para.get("Type", "Action")
        if kind in _ACTS and _words(para):
            read.append(Section(1, _words(para)))
        if kind in _ACTS or kind in _SKIP or not _words(para):
            continue
        element = _element(para, kind)
        runs = _trim([(t.upper() if element in CAPITALS else t, s) for t, s in _runs(para)])
        if element == "heading":
            runs = [(SCENE_NUMBER.sub("", t), s) for t, s in runs]
        elif element == "lyric":
            runs = [(t, "") for t, _ in runs]  # a lyric is italic by its element
        last = read[-1] if read else None
        if element in ("dialogue", "lyric") and isinstance(last, _Para) and last.element == element:
            # Final Draft breaks a speech into paragraphs; it is one block, its lines kept.
            last.runs += [("\n", ""), *runs]
            last.notes += _notes(para)
            continue
        summary = para.find("SceneProperties/Summary")
        synopsis = " ".join(_words(p) for p in summary.iter("Paragraph")).strip() if summary is not None else ""
        read.append(_Para(element, runs, _notes(para), synopsis, dual))
    for item in read:
        if isinstance(item, Section):
            src.items.append(item)
            continue
        src.block(item.element, item.runs, item.notes, item.dual)
        if item.synopsis:
            src.items.append(Synopsis(item.synopsis))
    return src
