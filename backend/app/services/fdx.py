"""
Final Draft's .fdx, written out (doc 25, P3): writers hand scripts on in Final Draft.

An FDX file is XML: one `<Paragraph Type="…">` per element, which Final Draft (and Fade In,
WriterDuet, Highland) lays out with its own standard settings for each type. A line break inside
a block becomes the next paragraph of the same type.
"""

from __future__ import annotations

from xml.sax.saxutils import escape, quoteattr

from .script_export import ScriptDoc, ScriptOptions

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
