"""
Reading a Fountain or Final Draft file for import (doc 25, P6): the blocks as written, and what
the file says around them (title page, acts, synopses, notes). What LoreStudio writes out, it
reads back to the same blocks.
"""

import pytest

from app.schemas.story import TitlePage
from app.services import fdx, fountain
from app.services.script_export import Block, ScriptDoc, ScriptOptions
from app.services.script_source import Block as Read
from app.services.script_source import SceneNote, Section, Synopsis
from app.services.seed_screenplay import KNOCK, LOGBOOK, THE_LIGHT

FOUNTAIN = """Title: **THE LAST LIGHTHOUSE**
Credit: Written by
Author: A. Writer
Draft date: 10 October 2026
Contact:
    writer@example.com
    555-0100

FADE IN:

# ACT ONE

= Eleanor sees a boat.

INT. LIGHTHOUSE, LAMP ROOM - DUSK #1#

= She logs the falling glass.

She writes *quietly* in the log [[check the year]]
and then **stops**. A \\*star\\*.

/* cut this
ELEANOR
Gone.
*/

ELEANOR (V.O.)
(her father's words)
The glass doesn't lie.
People lie.

[[a scene note]]

BOB ^
Hello.

## The cottage

===

EXT. KEEPER'S COTTAGE - NIGHT

Rain.
"""


def _blocks(src):
    return [(i.element, i.text) for i in src.items if isinstance(i, Read)]


def test_fountain_title_page():
    src = fountain.parse(FOUNTAIN)
    assert (src.title, src.author) == ("THE LAST LIGHTHOUSE", "A. Writer")
    assert src.page == {"credit": "Written by", "contact": "writer@example.com\n555-0100", "date": "10 October 2026"}
    assert TitlePage(**src.page).credit == "Written by"


def test_fountain_blocks_as_written():
    src = fountain.parse(FOUNTAIN)
    assert _blocks(src) == [
        ("action", "FADE IN:"),
        ("heading", "INT. LIGHTHOUSE, LAMP ROOM - DUSK"),  # the scene number is the export's to make
        ("action", "She writes quietly in the log\nand then stops. A *star*."),
        ("cue", "ELEANOR (V.O.)"),
        ("paren", "(her father's words)"),
        ("dialogue", "The glass doesn't lie.\nPeople lie."),
        ("cue", "BOB"),  # "^" (dual dialogue) waits for P8
        ("dialogue", "Hello."),
        ("heading", "EXT. KEEPER'S COTTAGE - NIGHT"),
        ("action", "Rain."),
    ]
    assert not any("Gone" in t for _, t in _blocks(src))  # the boneyard is left out


def test_fountain_marks_notes_sections_and_synopses():
    src = fountain.parse(FOUNTAIN)
    action = next(i for i in src.items if isinstance(i, Read) and "writes" in i.text)
    [(note_id, (note, anchor))] = src.notes.items()
    assert (note, anchor) == ("check the year", action.text)
    assert action.html == (
        f'<span data-note-id="{note_id}" class="note-anchor">She writes <em>quietly</em> in the log<br>'
        "and then <strong>stops</strong>. A *star*.</span>"
    )
    others = [i for i in src.items if not isinstance(i, Read)]
    assert others == [
        Section(1, "ACT ONE"),
        Synopsis("Eleanor sees a boat."),
        Synopsis("She logs the falling glass."),
        SceneNote("a scene note"),
        Section(2, "The cottage"),
    ]


def test_a_file_with_no_title_page_starts_at_once():
    src = fountain.parse("FADE IN:\n\nINT. ROOM - DAY\n\nRain.\n")
    assert src.title == "" and _blocks(src)[0] == ("action", "FADE IN:")


DEMO = THE_LIGHT + KNOCK + LOGBOOK


def _doc() -> ScriptDoc:
    page = TitlePage(contact="A. Writer\nwriter@example.com", draft="Second draft", date="9 October 2026")
    return ScriptDoc("The Last Lighthouse", "A. Writer", page, [Block(el, text) for el, text in DEMO])


@pytest.mark.parametrize("write", ["fountain", "fdx"])
def test_what_loreStudio_writes_it_reads_back(write):
    doc = _doc()
    if write == "fountain":
        src = fountain.parse(fountain.to_fountain(doc, ScriptOptions(scene_numbers=True)))
    else:
        src = fdx.parse(fdx.to_fdx(doc, ScriptOptions(scene_numbers=True)).encode())
    assert _blocks(src) == DEMO
    assert (src.title.title(), src.author) == ("The Last Lighthouse", "A. Writer")
    assert src.page["contact"] == "A. Writer\nwriter@example.com"


FDX = """<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
  <Content>
    <Paragraph Type="New Act"><Text>ACT ONE</Text></Paragraph>
    <Paragraph Number="1" Type="Scene Heading">
      <SceneProperties Length="1/8" Title=""><Summary><Paragraph><Text>A boat in the storm.</Text></Paragraph></Summary></SceneProperties>
      <Text>int. lamp room - dusk</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <ScriptNote><Paragraph><Text>Check the year.</Text></Paragraph></ScriptNote>
      <Text>She writes </Text><Text Style="Italic">quietly</Text><Text>.</Text>
    </Paragraph>
    <Paragraph Type="Shot"><Text>CLOSE ON THE LOG</Text></Paragraph>
    <Paragraph>
      <DualDialogue>
        <Paragraph Type="Character"><Text>ELEANOR</Text></Paragraph>
        <Paragraph Type="Dialogue"><Text>Now.</Text></Paragraph>
        <Paragraph Type="Character"><Text>BOB</Text></Paragraph>
        <Paragraph Type="Dialogue"><Text>Now?</Text></Paragraph>
      </DualDialogue>
    </Paragraph>
    <Paragraph Type="Dialogue"><Text>Then later.</Text></Paragraph>
    <Paragraph Type="End of Act"><Text>END OF ACT ONE</Text></Paragraph>
  </Content>
  <TitlePage><Content>
    <Paragraph Alignment="Center"><Text>THE LIGHT</Text></Paragraph>
    <Paragraph Alignment="Center"><Text>Written by</Text></Paragraph>
    <Paragraph Alignment="Center"><Text>A. Writer</Text></Paragraph>
    <Paragraph Alignment="Right"><Text>Blue revision</Text></Paragraph>
  </Content></TitlePage>
</FinalDraft>
"""


def test_final_draft_paragraphs_as_elements():
    src = fdx.parse(FDX.encode())
    assert src.items[0] == Section(1, "ACT ONE")
    assert _blocks(src) == [
        ("heading", "INT. LAMP ROOM - DUSK"),
        ("action", "She writes quietly."),
        ("action", "CLOSE ON THE LOG"),
        ("cue", "ELEANOR"),
        ("dialogue", "Now."),
        ("cue", "BOB"),
        ("dialogue", "Now?\nThen later."),  # a speech in two paragraphs is one block
    ]
    assert Synopsis("A boat in the storm.") in src.items
    action = next(i for i in src.items if isinstance(i, Read) and i.element == "action")
    assert "<em>quietly</em>" in action.html and list(src.notes.values()) == [("Check the year.", action.text)]
    assert (src.title, src.author, src.page) == (
        "THE LIGHT",
        "A. Writer",
        {"credit": "Written by", "draft": "Blue revision"},
    )


@pytest.mark.parametrize(
    "data",
    [
        b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><FinalDraft><Content/></FinalDraft>',
        b"<FinalDraft><Content>",
        b"<Script><Content/></Script>",
    ],
)
def test_a_file_final_draft_did_not_write_is_refused(data):
    with pytest.raises(ValueError):
        fdx.parse(data)
