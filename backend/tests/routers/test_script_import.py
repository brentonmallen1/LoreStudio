"""
A Fountain or Final Draft file opened as a screenplay story (doc 25, P6), through the import
wizard's own steps: the scenes and acts the file states, the people its cues name and the places
its headings name, and the story made a script with its title page, synopses and notes.
"""

import pytest

from app.models import Character, Location, Note, Story
from app.models.dialogue import DialogueBlock
from app.models.location import SceneSetting
from app.models.structure import StoryStructureTemplate, StructureNode
from app.services.seed import STRUCTURE_TEMPLATES

SCRIPT = """Title: The Light
Author: A. Writer
Contact: writer@example.com

FADE IN:

# ACT ONE

INT. LIGHTHOUSE, LAMP ROOM - DUSK

= Eleanor sees a boat.

Eleanor writes in the log. [[check the year]]

ELEANOR
The glass doesn't lie.

THOMAS
Keep it lit.

ELEANOR
I will.

EXT. KEEPER'S COTTAGE - NIGHT

[[rain all night?]]

A knock.

WAITER
Sir?

# ACT TWO

INT. LIGHTHOUSE, LAMP ROOM - LATER

THOMAS
Again.
"""


@pytest.fixture(autouse=True)
def templates(db_session):
    for t in STRUCTURE_TEMPLATES:
        db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _upload(client, data=SCRIPT, name="the-light.fountain", template="screenplay"):
    body = data.encode() if isinstance(data, str) else data
    r = client.post(
        "/api/import/upload", params={"template_id": template}, files={"file": (name, body, "application/octet-stream")}
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_the_structure_is_the_one_the_file_states(client):
    up = _upload(client)
    assert (up["source_format"], up["detected_title"], up["has_unstructured_blocks"]) == (
        "fountain",
        "The Light",
        False,
    )
    nodes = [(n["level"], n["title"]) for n in up["preview"]["nodes"]]
    assert nodes == [
        (0, "ACT ONE"),
        (1, "Lighthouse, Lamp Room"),  # "FADE IN:" stays with the first scene
        (1, "Keeper's Cottage"),
        (0, "ACT TWO"),
        (1, "Lighthouse, Lamp Room"),
    ]


def test_the_lorebook_entries_are_who_speaks_and_where(client):
    up = _upload(client)
    sid = up["session_id"]
    found = client.post(f"/api/import/{sid}/extract-preview", json={}).json()["candidates"]
    named = {(c["entity_type"], c["name"], c["occurrences"]) for c in found}
    # The waiter speaks once, and stays in the script alone.
    assert named == {
        ("character", "Eleanor", 2),
        ("character", "Thomas", 2),
        ("location", "Lighthouse, Lamp Room", 2),
        ("location", "Keeper's Cottage", 1),
    }


def test_finishing_makes_a_screenplay(client, db_session):
    up = _upload(client)
    sid = up["session_id"]
    found = client.post(f"/api/import/{sid}/extract-preview", json={}).json()["candidates"]
    r = client.post(
        f"/api/import/{sid}/finalize",
        json={
            "title": "The Light",
            "template_id": "screenplay",
            "extraction_candidate_ids": [c["id"] for c in found],
            "extraction_candidates": found,
        },
    )
    assert r.status_code == 200, r.text
    story = db_session.get(Story, r.json()["id"])
    assert story.story_format == "screenplay" and story.author_name == "A. Writer"
    assert story.title_page["contact"] == "writer@example.com"

    scenes = db_session.query(StructureNode).filter_by(story_id=story.id, level=1).all()
    lamp = next(s for s in scenes if s.content.startswith('<p data-el="action">FADE IN:</p>'))
    assert (lamp.interior, lamp.time_of_day, lamp.synopsis) == ("INT", "DUSK", "Eleanor sees a boat.")
    assert lamp.line_count > 0 and lamp.word_count > 0
    place = db_session.query(SceneSetting).filter_by(node_id=lamp.id, role="primary").one()
    assert db_session.get(Location, place.location_id).name == "Lighthouse, Lamp Room"

    anchored = db_session.query(Note).filter(Note.anchor.isnot(None)).one()
    assert (anchored.node_id, anchored.content, anchored.anchor) == (
        lamp.id,
        "check the year",
        "Eleanor writes in the log.",
    )
    assert f'data-note-id="{anchored.id}"' in lamp.content
    cottage = next(s for s in scenes if "COTTAGE" in s.content)
    assert db_session.query(Note).filter_by(node_id=cottage.id, anchor=None).one().content == "rain all night?"

    eleanor = db_session.query(Character).filter_by(story_id=story.id, name="Eleanor").one()
    spoken = db_session.query(DialogueBlock).filter_by(scene_id=lamp.id, character_id=eleanor.id).all()
    assert [d.content for d in spoken] == ["The glass doesn't lie.", "I will."]


def test_a_final_draft_file_takes_the_same_steps(client):
    fdx = b"""<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5"><Content>
<Paragraph Type="Scene Heading"><Text>INT. LAMP ROOM - DUSK</Text></Paragraph>
<Paragraph Type="Action"><Text>The lamp turns.</Text></Paragraph>
<Paragraph Type="Scene Heading"><Text>EXT. CLIFF - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>Wind.</Text></Paragraph>
</Content></FinalDraft>"""
    up = _upload(client, fdx, "light.fdx")
    assert up["source_format"] == "fdx"
    assert [n["title"] for n in up["preview"]["nodes"]] == ["Lamp Room", "Cliff"]


@pytest.mark.parametrize(
    ("name", "data"),
    [("empty.fountain", "Title: Nothing\n\n"), ("broken.fdx", "<FinalDraft><Content>"), ("x.fdx", "<!DOCTYPE x>")],
)
def test_a_file_with_no_script_says_so(client, name, data):
    r = client.post("/api/import/upload", files={"file": (name, data.encode(), "application/octet-stream")})
    assert r.status_code == 422
