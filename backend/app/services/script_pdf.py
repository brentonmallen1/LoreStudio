"""
A screenplay's PDF, laid out the way the industry prints one (doc 25, D5 and the export layout
spec).

The paginator in `script_syntax` decides every line and every break, the same paginator the
app counts pages with. Here each page becomes a fixed box with its lines placed absolutely,
in Courier Prime 12pt (ten characters to the inch, six lines to the inch), and WeasyPrint only
prints those boxes: it never wraps or breaks anything itself.
"""

from __future__ import annotations

import html
from dataclasses import dataclass, field
from pathlib import Path

from .script_export import ScriptDoc, ScriptOptions
from .script_syntax import LINES_PER_PAGE, Line, paginate

FONTS_DIR = Path(__file__).parent.parent / "assets" / "fonts"

PT_PER_IN = 72
#: Twelve points: one line, six to the inch.
LINE_PT = 12
#: A Courier Prime character at 12pt: a tenth of an inch.
CHAR_PT = 7.2
TOP_PT = 72  # 1in
LEFT_PT = 108  # 1.5in
RIGHT_EDGE_PT = 540  # 7.5in: where the page number and transitions end
NUMBER_TOP_PT = 36  # 0.5in

#: Width and height in inches. Letter's 55 lines leave about 0.83in at the foot; A4 keeps that
#: margin, so it fits more lines.
PAGE_SIZES: dict[str, tuple[float, float]] = {"letter": (8.5, 11.0), "a4": (8.27, 11.69)}
_FOOT_IN = 11.0 - 1.0 - LINES_PER_PAGE / 6


def lines_per_page(size: str) -> int:
    _, height = PAGE_SIZES.get(size, PAGE_SIZES["letter"])
    return int((height - 1.0 - _FOOT_IN) * 6 + 1e-6)


_LATIN = (
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, "
    "U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
)
_LATIN_EXT = (
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, "
    "U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
)


def _font_faces() -> str:
    faces = []
    for style, weight, name in (
        ("normal", 400, "normal-400"),
        ("normal", 700, "normal-700"),
        ("italic", 400, "italic-400"),
    ):
        for sub, ranges in (("latin", _LATIN), ("latin-ext", _LATIN_EXT)):
            faces.append(
                f'@font-face {{ font-family: "Courier Prime"; font-style: {style}; font-weight: {weight}; '
                f'src: url("CourierPrime-{name}-{sub}.ttf"); unicode-range: {ranges}; }}'
            )
    return "\n".join(faces)


@dataclass
class Item:
    """One printed line: where it sits (points from the page's top left) and how it is set.
    `kind` is "" (plain), "bold" (a bold heading) or "centre" (centred across the page, on the
    title page; `left` is then 0)."""

    top: float
    left: float
    text: str
    kind: str = ""


@dataclass
class Layout:
    """The script's pages, as both the PDF and the in-app preview draw them."""

    width_pt: float
    height_pt: float
    #: The title page, when there is one, then the script's pages.
    pages: list[list[Item]] = field(default_factory=list)
    #: The script's own pages, not counting the title page.
    page_count: int = 0


def _right(text: str, top: float, edge: float = RIGHT_EDGE_PT) -> Item:
    """A line that ends at `edge`."""
    return Item(top, edge - len(text) * CHAR_PT, text)


def _page_items(lines: list[Line | None], numbers: dict[int, int], options: ScriptOptions) -> list[Item]:
    out = []
    for i, line in enumerate(lines):
        if line is None:
            continue
        top = TOP_PT + i * LINE_PT
        bold = "bold" if options.bold_headings and line.element == "heading" else ""
        out.append(Item(top, LEFT_PT + line.x * CHAR_PT, line.text, bold))
        if options.scene_numbers and i in numbers:
            n = f"{numbers[i]}"
            out.append(_right(n, top, LEFT_PT - 3 * CHAR_PT))
            out.append(Item(top, RIGHT_EDGE_PT + 3 * CHAR_PT, n))
    return out


def _numbered_lines(doc: ScriptDoc, pages) -> list[dict[int, int]]:
    """For each page, the scene number on each heading's first line, matched in order."""
    numbers = iter([b.number for b in doc.blocks if b.element == "heading"])
    out: list[dict[int, int]] = []
    for page in pages:
        found: dict[int, int] = {}
        prev: Line | None = None
        for i, line in enumerate(page.lines):
            if line is not None and line.element == "heading" and (prev is None or prev.element != "heading"):
                number = next(numbers, None)
                if number is not None:
                    found[i] = number
            prev = line
        out.append(found)
    return out


def _title_page(doc: ScriptDoc, height_pt: float) -> list[Item]:
    page = doc.page
    out = []
    centre = [doc.title.upper(), "", page.credit, "", doc.author] if doc.author else [doc.title.upper()]
    if page.based_on.strip():
        centre += ["", *page.based_on.strip().split("\n")]
    top = round(height_pt / 3 / LINE_PT) * LINE_PT
    out += [Item(top + i * LINE_PT, 0, text, "centre") for i, text in enumerate(centre) if text]
    foot = height_pt - TOP_PT  # the last line sits an inch from the bottom
    contact = [t.strip() for t in page.contact.strip().split("\n") if t.strip()]
    out += [Item(foot - (len(contact) - 1 - i) * LINE_PT, LEFT_PT, text) for i, text in enumerate(contact)]
    draft = [t for t in (page.draft.strip(), page.date.strip()) if t]
    out += [_right(text, foot - (len(draft) - 1 - i) * LINE_PT) for i, text in enumerate(draft)]
    return out


def layout(doc: ScriptDoc, options: ScriptOptions) -> Layout:
    """Every page of the script, every line placed: the paginator's pages, numbered from two."""
    width_in, height_in = PAGE_SIZES.get(options.page_size, PAGE_SIZES["letter"])
    out = Layout(width_in * PT_PER_IN, height_in * PT_PER_IN)
    pages = paginate(doc.pairs, lines_per_page(options.page_size)) if doc.blocks else []
    if options.title_page:
        out.pages.append(_title_page(doc, out.height_pt))
    for k, (page, numbers) in enumerate(zip(pages, _numbered_lines(doc, pages), strict=True), start=1):
        items = _page_items(page.lines, numbers, options)
        if k > 1:  # no number on page one, nor on the title page
            items.insert(0, _right(f"{k}.", NUMBER_TOP_PT))
        out.pages.append(items)
    out.page_count = len(pages)
    return out


_CLASS = {"": "l", "bold": "l b", "centre": "l c"}


def _html_item(item: Item) -> str:
    where = f"top:{item.top:g}pt" if item.kind == "centre" else f"top:{item.top:g}pt;left:{item.left:g}pt"
    return f'<div class="{_CLASS[item.kind]}" style="{where}">{html.escape(item.text)}</div>'


def render_html(doc: ScriptDoc, options: ScriptOptions) -> str:
    """The script as fixed pages of placed lines, ready for WeasyPrint."""
    pages = layout(doc, options)
    width_in, height_in = pages.width_pt / PT_PER_IN, pages.height_pt / PT_PER_IN
    boxes = ['<div class="p">' + "".join(_html_item(i) for i in items) + "</div>" for items in pages.pages]
    style = f"""
{_font_faces()}
@page {{ size: {width_in:g}in {height_in:g}in; margin: 0; }}
html, body {{ margin: 0; padding: 0; }}
body {{ font-family: "Courier Prime", "Courier New", monospace; font-size: 12pt; line-height: {LINE_PT}pt; }}
.p {{ position: relative; width: {width_in:g}in; height: {height_in:g}in; overflow: hidden; page-break-after: always; }}
.p:last-child {{ page-break-after: auto; }}
.l {{ position: absolute; white-space: pre; height: {LINE_PT}pt; }}
.b {{ font-weight: 700; }}
.c {{ left: 0; right: 0; text-align: center; }}
"""
    title = html.escape(doc.title)
    body = "\n".join(boxes)
    head = f'<meta charset="utf-8"><title>{title}</title><style>{style}</style>'
    return f"<!DOCTYPE html><html><head>{head}</head><body>{body}</body></html>"


def render_pdf(doc: ScriptDoc, options: ScriptOptions) -> bytes:
    import weasyprint  # needs Pango; imported where it is used, as routers/export does at load

    return weasyprint.HTML(string=render_html(doc, options), base_url=f"{FONTS_DIR}/").write_pdf()
