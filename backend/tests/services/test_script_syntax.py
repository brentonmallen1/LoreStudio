"""The script grammar against the shared cases (shared/script-syntax/cases.json): the editor's
tests run the same file, so the page count it shows is the one the PDF prints (doc 25, D5)."""

import json
from pathlib import Path

import pytest

from app.services import script_syntax as ss

CASES = json.loads((Path(__file__).parents[3] / "shared" / "script-syntax" / "cases.json").read_text())


def test_layout():
    assert CASES["layout"] == {"lines_per_page": ss.LINES_PER_PAGE, "elements": ss.LAYOUT}
    assert set(ss.LAYOUT) == set(ss.ELEMENTS)


def test_enter_and_tab():
    assert CASES["next"] == {"enter": ss.ENTER_NEXT, "tab": ss.TAB_NEXT, "shift_tab": ss.SHIFT_TAB_NEXT}


@pytest.mark.parametrize(("text", "prev", "expect"), CASES["classify"], ids=lambda v: str(v)[:30])
def test_classify(text, prev, expect):
    assert ss.classify_line(text, prev) == expect


@pytest.mark.parametrize(("element", "text", "expect"), CASES["clean"])
def test_clean(element, text, expect):
    assert ss.clean(element, text) == expect


@pytest.mark.parametrize(("name", "cue"), CASES["cue_names"])
def test_cue_name(name, cue):
    assert ss.cue_name(name) == cue


@pytest.mark.parametrize(("text", "name", "extensions", "dual"), CASES["cue"])
def test_cue(text, name, extensions, dual):
    assert ss.parse_cue(text) == ss.Cue(name, tuple(extensions), dual)


@pytest.mark.parametrize("case", CASES["parse"], ids=lambda c: c["text"][:30])
def test_parse(case):
    assert [list(b) for b in ss.parse_lines(case["text"])] == case["expect"]


@pytest.mark.parametrize(("text", "interior", "place", "time", "printed"), CASES["slugline"])
def test_slugline(text, interior, place, time, printed):
    slug = ss.parse_slugline(text)
    assert slug == ss.Slug(interior, place, time)
    assert ss.format_slugline(slug) == printed


@pytest.mark.parametrize(("blocks", "at"), CASES["heading_at"])
def test_heading_at(blocks, at):
    assert ss.heading_at([tuple(b) for b in blocks]) == at


@pytest.mark.parametrize(("text", "width", "hang", "lines"), CASES["wrap"], ids=lambda v: str(v)[:30])
def test_wrap(text, width, hang, lines):
    assert ss.wrap(text, width, hang=hang) == lines


def _show(pages):
    return [["" if ln is None else f"{ln.element}|{ln.x}|{ln.text}" for ln in page.lines] for page in pages]


@pytest.mark.parametrize("case", CASES["paginate"], ids=lambda c: c["_why"][:40])
def test_paginate(case):
    assert _show(ss.paginate([tuple(b) for b in case["blocks"]], 10)) == case["pages"]


@pytest.mark.parametrize(("blocks", "lines", "eighths"), CASES["scene_lines"])
def test_scene_lines(blocks, lines, eighths):
    assert ss.scene_lines([tuple(b) for b in blocks]) == lines
    assert ss.eighths(lines) == eighths


def test_a_long_scene_runs_to_its_pages():
    assert ss.page_count([]) == 0
    assert ss.page_count([("action", "word " * 3000)]) == 5


def test_a_stored_scene_reads_as_its_blocks():
    html = (
        '<p data-el="heading">INT. LIGHTHOUSE - NIGHT</p>'
        "<p>She climbs to [[The Lamp Room]].</p>"
        '<p data-el="cue">ELEANOR</p>'
        '<p data-el="dialogue">It is <em>still</em> burning.</p>'
    )
    assert ss.scene_blocks(html) == [
        ("heading", "INT. LIGHTHOUSE - NIGHT"),
        ("action", "She climbs to The Lamp Room."),
        ("cue", "ELEANOR"),
        ("dialogue", "It is still burning."),
    ]
