"""
A screenplay handed on (doc 25, P3): the PDF laid out to the export spec, Fountain that reads
back to the same blocks, Final Draft's XML, and the title page.

The PDF's layout is ours, not WeasyPrint's: every line is placed at a position this code
computes, so the tests read the positions from the page HTML. (The tests replace WeasyPrint
with a mock; the real render is checked by hand against the same HTML.)
"""

import html as _html
import re
import xml.etree.ElementTree as ET

import pytest

from app.models import Story
from app.models.structure import StoryStructureTemplate
from app.schemas.story import TitlePage
from app.services.fdx import to_fdx
from app.services.fountain import to_fountain
from app.services.script_export import Block, ScriptDoc, ScriptOptions, build_script
from app.services.script_pdf import lines_per_page, render_html
from app.services.script_syntax import paginate, parse_lines
from app.services.seed import STRUCTURE_TEMPLATES

SCENE = [
    ("heading", "INT. KEEPER'S COTTAGE - NIGHT"),
    ("action", "Rain on the window. ELEANOR waits."),
    ("cue", "ELEANOR"),
    ("paren", "(quietly)"),
    ("dialogue", "Don't open the door."),
    ("action", "A knock. Three of them."),
    ("cue", "ELEANOR"),
    ("dialogue", "I said don't."),
    ("transition", "CUT TO:"),
]


def _doc(blocks=SCENE, **page) -> ScriptDoc:
    numbered, n = [], 0
    for el, text in blocks:
        n += el == "heading"
        numbered.append(Block(el, text, n if el == "heading" else None))
    return ScriptDoc("The Last Lighthouse", "A. Writer", TitlePage(**page), numbered)


def _lines(html: str) -> list[tuple[int, float, float, str]]:
    """Every placed line: (page, top pt, left pt, text)."""
    out = []
    for p, page in enumerate(html.split('<div class="p">')[1:]):
        for top, left, text in re.findall(r'style="top:([\d.]+)pt;left:([\d.]+)pt">([^<]*)<', page):
            out.append((p, float(top), float(left), _html.unescape(text)))
    return out


def _left(html: str, text: str) -> float:
    return next(left for _, _, left, t in _lines(html) if t == text)


def test_each_element_sits_where_the_spec_puts_it():
    html = render_html(_doc(), ScriptOptions(title_page=False))
    inch = 72
    assert _left(html, "INT. KEEPER'S COTTAGE - NIGHT") == 1.5 * inch
    assert _left(html, "A knock. Three of them.") == 1.5 * inch
    assert _left(html, "ELEANOR") == pytest.approx(3.7 * inch)
    assert _left(html, "(quietly)") == pytest.approx(3.1 * inch)
    assert _left(html, "Don't open the door.") == pytest.approx(2.5 * inch)
    # A transition ends at 7.5in: ten characters to the inch.
    assert _left(html, "CUT TO:") + len("CUT TO:") * 7.2 == pytest.approx(7.5 * inch)
    tops = [
        top
        for _, top, _, t in _lines(html)
        if t in ("INT. KEEPER'S COTTAGE - NIGHT", "Rain on the window. ELEANOR waits.")
    ]
    assert tops == [72, 72 + 24]  # an inch down; a blank line, six to the inch, between


def test_pages_are_the_paginators_and_numbered_from_two():
    speech = [("cue", "ELEANOR"), ("dialogue", "The light has to stay lit. " * 6)] * 12
    blocks = [("heading", "INT. LAMP ROOM - NIGHT"), *speech]
    doc = _doc(blocks)
    html = render_html(doc, ScriptOptions())
    pages = paginate(doc.pairs)
    assert len(pages) >= 2
    assert html.count('<div class="p">') == len(pages) + 1  # and the title page
    numbers = [(p, t) for p, top, _, t in _lines(html) if top == 36]
    assert numbers == [(k, f"{k}.") for k in range(2, len(pages) + 1)]


def test_a_speech_over_a_page_closes_with_more_and_goes_on_contd():
    # Each sentence fills one 35-character line of dialogue, so the speech can break after any.
    speech = " ".join(["The keeper climbs the stair again."] * 30)
    blocks = [
        ("heading", "INT. LAMP ROOM - NIGHT"),
        ("action", "The lamp turns. " * 120),
        ("cue", "ELEANOR"),
        ("dialogue", speech),
    ]
    html = render_html(_doc(blocks), ScriptOptions(title_page=False))
    lines = _lines(html)
    more = next((p, top) for p, top, _, t in lines if t == "(MORE)")
    contd = next((p, top) for p, top, _, t in lines if t == "ELEANOR (CONT'D)")
    assert contd == (more[0] + 1, 72)  # the next page opens on the cue
    before = [t for p, _, left, t in lines if p == more[0] and left == 180]
    assert len(before) >= 2 and before[-1].endswith(".")


def test_scene_numbers_go_in_both_margins():
    html = render_html(_doc(), ScriptOptions(title_page=False, scene_numbers=True))
    ones = [left for _, top, left, t in _lines(html) if t == "1" and top == 72]
    assert len(ones) == 2 and ones[0] < 108 < 540 < ones[1]


def test_the_title_page():
    doc = _doc(
        based_on="Based on the novel by A. Writer",
        contact="A. Writer\nwriter@example.com",
        draft="Second draft",
        date="9 October 2026",
    )
    html = render_html(doc, ScriptOptions())
    title = html.split('<div class="p">')[1]
    for text in (
        "THE LAST LIGHTHOUSE",
        "Written by",
        "A. Writer",
        "Based on the novel by A. Writer",
        "writer@example.com",
        "Second draft",
    ):
        assert f">{text}<" in title
    assert "top:36pt;" not in title  # no page number on the title page


def test_a4_fits_more_lines_than_letter():
    assert lines_per_page("letter") == 55
    assert lines_per_page("a4") == 59


def test_contd_when_the_same_voice_speaks_again_across_action(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    html = "".join(f'<p data-el="{el}">{t}</p>' for el, t in SCENE) + (
        '<p data-el="cue">THE VISITOR</p><p data-el="dialogue">Open up.</p>'
        '<p data-el="cue">ELEANOR</p><p data-el="dialogue">No.</p>'
        '<p data-el="heading">EXT. LIGHTHOUSE - CONTINUOUS</p>'
        '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Wait!</p>'
    )
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": html})
    from app.services.manuscript_builder import get_manuscript_sections

    row = db_session.get(Story, story["id"])
    doc = build_script(row, get_manuscript_sections(row, db_session))
    cues = [b.text for b in doc.blocks if b.element == "cue"]
    assert cues == ["ELEANOR", "ELEANOR (CONT'D)", "THE VISITOR", "ELEANOR", "ELEANOR"]
    assert [b.number for b in doc.blocks if b.element == "heading"] == [1, 2]
    plain = build_script(row, get_manuscript_sections(row, db_session), auto_contd=False)
    assert "ELEANOR (CONT'D)" not in [b.text for b in plain.blocks]


TRICKY = [
    ("heading", "INT. KEEPER'S COTTAGE - NIGHT"),
    ("heading", "THE LAMP ROOM"),  # no INT./EXT.: forced with "."
    ("action", "SILENCE\nThen a knock."),  # capitals that would read as a cue
    ("action", "BOOM!"),
    ("cue", "McCLANE"),  # not in capitals: forced with "@"
    ("dialogue", "Yippee."),
    ("cue", "ELEANOR (V.O.)"),
    ("paren", "(quietly)"),
    ("dialogue", "Don't."),
    ("transition", "FADE OUT."),  # not "TO:": forced with ">"
    ("action", "INT. is what the sign says."),  # reads as a heading
]


def test_fountain_reads_back_to_the_same_blocks():
    text = to_fountain(_doc(TRICKY), ScriptOptions(title_page=False))
    assert parse_lines(text) == TRICKY
    assert ".THE LAMP ROOM" in text and "@McCLANE" in text and "> FADE OUT." in text and "!SILENCE" in text


def test_fountain_title_page_and_scene_numbers():
    doc = _doc(contact="A. Writer\nwriter@example.com", draft="Second draft", date="9 October 2026")
    text = to_fountain(doc, ScriptOptions(scene_numbers=True))
    head, _, body = text.partition("\n\n")
    assert head.split("\n") == [
        "Title: The Last Lighthouse",
        "Credit: Written by",
        "Author: A. Writer",
        "Draft date: Second draft, 9 October 2026",
        "Contact:",
        "   A. Writer",
        "   writer@example.com",
    ]
    assert body.startswith("INT. KEEPER'S COTTAGE - NIGHT #1#")


def test_fountain_keeps_the_authors_asterisks_literal():
    text = to_fountain(_doc([("action", "The *real* keeper_name.")]), ScriptOptions(title_page=False))
    assert text.strip() == r"The \*real\* keeper\_name."


def test_fdx_is_final_drafts_paragraphs():
    root = ET.fromstring(to_fdx(_doc(TRICKY), ScriptOptions(scene_numbers=True)))
    paras = root.find("Content").findall("Paragraph")
    kinds = [p.get("Type") for p in paras]
    assert kinds[:6] == ["Scene Heading", "Scene Heading", "Action", "Action", "Action", "Character"]
    assert [p.get("Number") for p in paras[:2]] == ["1", "2"]
    assert paras[2].find("Text").text == "SILENCE" and paras[3].find("Text").text == "Then a knock."
    assert "THE LAST LIGHTHOUSE" in [p.findtext("Text") for p in root.find("TitlePage/Content")]


def test_the_export_route_hands_on_a_script(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    client.patch(
        f"/api/structure/{story['start_node_id']}", json={"content": '<p data-el="heading">INT. ROOM - DAY</p>'}
    )
    client.patch(f"/api/stories/{story['id']}", json={"title_page": {"draft": "First draft"}})
    r = client.post(f"/api/stories/{story['id']}/export", json={"format": "fountain"})
    assert r.status_code == 200, r.text
    assert 'filename="Light.fountain"' in r.headers["content-disposition"]
    assert "Draft date: First draft" in r.text and "INT. ROOM - DAY" in r.text
    r = client.post(f"/api/stories/{story['id']}/export", json={"format": "fdx"})
    assert r.status_code == 200 and "<FinalDraft" in r.text

    prose = client.post("/api/stories", json={"title": "Salt", "structure_template_id": "three-act"}).json()
    client.patch(f"/api/structure/{prose['start_node_id']}", json={"content": "<p>Words.</p>"})
    assert client.post(f"/api/stories/{prose['id']}/export", json={"format": "fountain"}).status_code == 400


def test_the_preview_is_the_pdfs_layout(client, db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()
    story = client.post(
        "/api/stories", json={"title": "Light", "story_format": "screenplay", "structure_template_id": "screenplay"}
    ).json()
    html = "".join(f'<p data-el="{el}">{t}</p>' for el, t in SCENE)
    client.patch(f"/api/structure/{story['start_node_id']}", json={"content": html})
    r = client.get(f"/api/stories/{story['id']}/script-layout", params={"scene_numbers": True})
    assert r.status_code == 200, r.text
    got = r.json()
    assert (got["width_pt"], got["height_pt"], got["page_count"]) == (612, 792, 1)
    title, first = got["pages"]
    assert title[0] == {"top": 264, "left": 0, "text": "LIGHT", "kind": "centre"}
    assert {"top": 72, "left": 108, "text": "INT. KEEPER'S COTTAGE - NIGHT", "kind": ""} in first
    assert sum(1 for i in first if i["text"] == "1") == 2
    a4 = client.get(f"/api/stories/{story['id']}/script-layout", params={"page_size": "a4", "title_page": False})
    assert a4.json()["height_pt"] == pytest.approx(841.68) and len(a4.json()["pages"]) == 1
