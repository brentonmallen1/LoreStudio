"""
A TV script prints its acts (doc 25, P11): each top-level act of the outline opens a new page on
its title and closes "END OF …"; a feature prints none. The page count, the PDF, Fountain and
Final Draft agree, and the act lines read back as the act, not as lines of the script.
"""

import re
import xml.etree.ElementTree as ET

from sqlalchemy.orm import Session

from app.models import Story
from app.models.structure import StructureNode
from app.services import fdx, fountain, seed
from app.services.manuscript_builder import ManuscriptSection
from app.services.script_export import ScriptOptions, build_script, pages_in, section_acts
from app.services.script_pdf import layout
from app.services.script_source import Block as SourceBlock
from app.services.script_source import Section

SCENE = (
    '<p data-el="heading">INT. KEEPER\'S COTTAGE - NIGHT</p>'
    '<p data-el="action">Rain on the window.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Don\'t open the door.</p>'
)


def _section(i: int, heading: str, level: int, content: str | None) -> ManuscriptSection:
    leaf = content is not None
    return ManuscriptSection(f"n{i}", heading, level, leaf, content, 0, "draft")


SECTIONS = [
    _section(1, "Cold Open", 1, None),
    _section(2, "The knock", 2, SCENE),
    _section(3, "Act One", 1, None),
    _section(4, "The door", 2, SCENE),
    _section(5, "The logbook", 2, SCENE),
    _section(6, "Act Two", 1, None),
    _section(7, "Nothing yet", 2, ""),
]


def _story(length: str) -> Story:
    return Story(title="Lighthouse", story_format="screenplay", intended_length=length)


def _centred(doc) -> list[tuple[str, str]]:
    return [(b.text, b.act) for b in doc.blocks if b.element == "centered"]


def test_a_tv_script_prints_each_act_it_has_written():
    doc = build_script(_story("tv_half_hour"), SECTIONS)
    assert _centred(doc) == [
        ("COLD OPEN", "open"),
        ("END OF COLD OPEN", "close"),
        ("ACT ONE", "open"),
        ("END OF ACT ONE", "close"),
    ]  # Act Two has nothing written, so it prints nothing
    assert doc.blocks[0].text == "COLD OPEN"
    assert [b.number for b in doc.blocks if b.element == "heading"] == [1, 2, 3]


def test_a_feature_prints_no_acts():
    assert _centred(build_script(_story("feature"), SECTIONS)) == []


def test_each_act_starts_a_page_and_the_count_agrees():
    story = _story("tv_hour")
    pages = layout(build_script(story, SECTIONS), ScriptOptions(title_page=False)).pages
    firsts = [next(i.text for i in page if i.text.strip() and not re.fullmatch(r"\d+\.", i.text)) for page in pages]
    assert firsts == ["COLD OPEN", "ACT ONE"]
    leaves = [s for s in SECTIONS if s.is_leaf]
    count = pages_in([s.content for s in leaves], "screenplay", section_acts(SECTIONS))
    assert count == len(pages) == 2
    assert pages_in([s.content for s in leaves], "screenplay") == 1  # the same scenes as a feature


def test_fountain_writes_acts_as_sections_and_reads_them_back():
    text = fountain.to_fountain(build_script(_story("tv_half_hour"), SECTIONS), ScriptOptions(title_page=False))
    assert "===\n\n# Act One\n\n>ACT ONE<" in text
    assert ">END OF ACT ONE<" in text
    src = fountain.parse(text)
    assert [i.title for i in src.items if isinstance(i, Section)] == ["Cold Open", "Act One"]
    lines = [i.text for i in src.items if isinstance(i, SourceBlock)]
    assert not any("ACT ONE" in t or "COLD OPEN" in t for t in lines)


def test_final_draft_writes_new_act_and_end_of_act():
    xml = fdx.to_fdx(build_script(_story("tv_hour"), SECTIONS), ScriptOptions(title_page=False))
    paras = ET.fromstring(xml).find("Content").findall("Paragraph")
    acts = [
        (p.get("Type"), p.findtext("Text"), p.get("StartsNewPage"))
        for p in paras
        if p.get("Type") in ("New Act", "End of Act")
    ]
    assert acts[:2] == [("New Act", "COLD OPEN", "Yes"), ("End of Act", "END OF COLD OPEN", None)]
    src = fdx.parse(xml.encode())
    assert [i.title for i in src.items if isinstance(i, Section)] == ["COLD OPEN", "ACT ONE"]
    assert not any("END OF" in i.text for i in src.items if isinstance(i, SourceBlock))


def test_a_tv_template_starts_the_story_at_its_tv_length(client, db_session: Session, monkeypatch):
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    r = client.post(
        "/api/stories",
        json={"title": "Pilot", "story_format": "screenplay", "structure_template_id": "tv-hour", "scaffold": True},
    )
    assert r.status_code == 201, r.text
    assert r.json()["intended_length"] == "tv_hour"
    acts = (
        db_session.query(StructureNode)
        .filter(StructureNode.story_id == r.json()["id"], StructureNode.parent_id.is_(None))
        .order_by(StructureNode.position)
        .all()
    )
    assert [a.title for a in acts] == ["Teaser", "Act One", "Act Two", "Act Three", "Act Four", "Act Five"]
