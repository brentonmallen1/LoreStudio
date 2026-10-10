"""
Two speeches at once, centred lines and lyrics (doc 25, P8): stored, read, laid out side by side,
printed, and written to and read back from Fountain and Final Draft.
"""

import xml.etree.ElementTree as ET

from app.schemas.story import TitlePage
from app.services import fdx, fountain
from app.services.import_script import read_script
from app.services.script_dialogue import plan_script
from app.services.script_export import Block, ScriptDoc, ScriptOptions, _continued
from app.services.script_pdf import layout
from app.services.script_source import Block as Read
from app.services.script_syntax import scene_blocks

SCENE = (
    '<p data-el="cue">BRICK</p><p data-el="dialogue">Screw retirement.</p>'
    '<p data-el="cue" data-dual="true">STEEL</p><p data-el="dialogue">Screw retirement.</p>'
    '<p data-el="cue">ELEANOR</p><p data-el="lyric">Over the sea<br>and far away</p>'
    '<p data-el="centered">THE END</p>'
)
BLOCKS = [
    ("cue", "BRICK"),
    ("dialogue", "Screw retirement."),
    ("cue", "STEEL ^"),
    ("dialogue", "Screw retirement."),
    ("cue", "ELEANOR"),
    ("lyric", "Over the sea\nand far away"),
    ("centered", "THE END"),
]


def _doc(blocks=BLOCKS) -> ScriptDoc:
    return ScriptDoc("Light", "A. Writer", TitlePage(), [Block(e, t) for e, t in blocks])


def test_a_stored_scene_reads_its_dual_cue_the_fountain_way():
    assert scene_blocks(SCENE) == BLOCKS


def test_the_page_prints_them_side_by_side_and_the_lyric_in_italics():
    page = layout(_doc(), ScriptOptions(title_page=False)).pages[0]
    brick = next(i for i in page if i.text == "BRICK")
    steel = next(i for i in page if i.text == "STEEL")
    assert brick.top == steel.top and steel.left > brick.left + 200  # the right-hand column
    assert [i.kind for i in page if i.text == "Over the sea"] == ["italic"]
    end = next(i for i in page if i.text == "THE END")
    assert abs((end.left + len("THE END") * 7.2 / 2) - (108 + 216)) < 8  # centred on the 6in text block


def test_fountain_writes_and_reads_them_back():
    text = fountain.to_fountain(_doc(), ScriptOptions(title_page=False))
    assert "STEEL ^" in text and "~Over the sea\n~and far away" in text and ">THE END<" in text
    read = [i for i in fountain.parse(text).items if isinstance(i, Read)]
    assert [(i.element, i.text, i.dual) for i in read] == [
        ("cue", "BRICK", False),
        ("dialogue", "Screw retirement.", False),
        ("cue", "STEEL", True),
        ("dialogue", "Screw retirement.", False),
        ("cue", "ELEANOR", False),
        ("lyric", "Over the sea\nand far away", False),
        ("centered", "THE END", False),
    ]


def test_final_draft_writes_and_reads_them_back():
    data = fdx.to_fdx(_doc(), ScriptOptions(title_page=False))
    root = ET.fromstring(data)
    dual = root.find("Content/Paragraph/DualDialogue")
    assert [p.findtext("Text") for p in dual.findall("Paragraph")] == [
        "BRICK",
        "Screw retirement.",
        "STEEL",
        "Screw retirement.",
    ]
    assert root.find("Content/Paragraph[@Alignment='Center']").findtext("Text") == "THE END"
    read = [i for i in fdx.parse(data.encode()).items if isinstance(i, Read)]
    assert [(i.element, i.text, i.dual) for i in read] == [
        ("cue", "BRICK", False),
        ("dialogue", "Screw retirement.", False),
        ("cue", "STEEL", True),
        ("dialogue", "Screw retirement.", False),
        ("cue", "ELEANOR", False),
        ("lyric", "Over the sea\nand far away", False),
        ("centered", "THE END", False),
    ]


def test_an_import_stores_the_dual_cue_on_its_paragraph():
    paragraphs, *_ = read_script(b"BRICK\nNow.\n\nSTEEL ^\nNow.\n", "x.fountain")
    assert paragraphs[2].html == '<p data-el="cue" data-dual="true">STEEL</p>'


def test_a_lyric_is_its_singers_line():
    rows = plan_script(SCENE, lambda name: None)
    assert [(r["speaker_name"], r["content"]) for r in rows] == [
        ("Brick", "Screw retirement."),
        ("Steel", "Screw retirement."),
        ("Eleanor", "Over the sea\nand far away"),
    ]


def test_contd_goes_before_the_dual_mark():
    blocks = [Block("cue", "BRICK"), Block("dialogue", "One."), Block("action", "He sits."), Block("cue", "BRICK ^")]
    _continued(blocks)
    assert blocks[-1].text == "BRICK (CONT'D) ^"
