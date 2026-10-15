"""Review structure: each edit can be taken back, Auto-segment keeps the author's renames, and
the story keeps an "As imported" version."""

import pytest

from app.models import StorySnapshot, StructureNode
from app.services.import_review import resegment
from app.services.import_service import detect_structure_heuristic
from app.services.novelcrafter.importing import retitle
from tests.services.test_import_service import THREE_ACT_LEVELS, make_para

DRAFT = b"# Act One\n\n## Chapter 1: Scene 1: The Farm\n\nWords here.\n\n* * *\n\nMore words.\n\n## Two\n\nMore."


@pytest.fixture(autouse=True)
def _templates(db_session):
    from app.models import StoryStructureTemplate
    from app.services.seed import STRUCTURE_TEMPLATES

    for t in STRUCTURE_TEMPLATES:
        if t["id"] in ("freeform", "three-act", "snowflake"):
            db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _upload(client):
    r = client.post(
        "/api/import/upload",
        params={"template_id": "three-act"},
        files={"file": ("draft.md", DRAFT, "text/markdown")},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _adjust(client, sid, **adjustment):
    r = client.post(f"/api/import/{sid}/adjust", json={"adjustments": [adjustment]})
    assert r.status_code == 200, r.text
    return r.json()


def test_each_edit_can_be_taken_back(client):
    up = _upload(client)
    sid, first = up["session_id"], up["preview"]
    assert first["undo_depth"] == 0
    act = first["nodes"][0]["id"]
    renamed = _adjust(client, sid, action="rename", node_id=act, new_title="The Beginning")
    releveled = _adjust(client, sid, action="relevel", node_id=act, new_level=1)
    assert releveled["undo_depth"] == 2

    back = client.post(f"/api/import/{sid}/undo").json()
    assert back["nodes"] == renamed["nodes"] and back["undo_depth"] == 1
    back = client.post(f"/api/import/{sid}/undo").json()
    assert back["nodes"] == first["nodes"] and back["undo_depth"] == 0
    assert client.post(f"/api/import/{sid}/undo").status_code == 409


def test_an_edit_that_changes_nothing_is_not_a_step(client):
    up = _upload(client)
    sid = up["session_id"]
    out = _adjust(client, sid, action="merge_up", node_id=up["preview"]["nodes"][0]["id"])
    assert out["undo_depth"] == 0


def test_a_new_split_keeps_renames_and_strips_numbering():
    paragraphs = [
        make_para(0, "h2", "Chapter 1: Scene 1: The Farm"),
        make_para(1, "p", "Pre-dawn."),
        make_para(2, "p", "Later that day."),
    ]
    from app.schemas.import_schemas import BreakPosition
    from app.services.import_review import prose_sections
    from app.services.import_service import build_preview_tree

    breaks = detect_structure_heuristic(paragraphs)
    old = retitle(
        build_preview_tree(
            prose_sections(paragraphs, breaks, THREE_ACT_LEVELS),
            paragraphs,
            "s",
            "three-act",
            THREE_ACT_LEVELS,
            "novelcrafter",
            None,
        )
    )
    old.nodes[0] = old.nodes[0].model_copy(update={"title": "Farm Life", "source": "user"})
    ai = BreakPosition(after_index=1, level=2, source="ai", confidence=0.75)
    new = resegment(old, paragraphs, [*breaks, ai], retitle=retitle)
    assert [(n.level, n.title) for n in new.nodes] == [(1, "Farm Life"), (2, "The Farm"), (2, "Untitled Scene")]


def test_finalize_under_a_template_of_the_same_depth_keeps_the_edits(client, db_session):
    up = _upload(client)
    sid = up["session_id"]
    _adjust(client, sid, action="rename", node_id=up["preview"]["nodes"][0]["id"], new_title="The Beginning")
    r = client.post(f"/api/import/{sid}/finalize", json={"title": "Draft", "template_id": "snowflake"})
    assert r.status_code == 200, r.text
    top = db_session.query(StructureNode).filter_by(story_id=r.json()["id"], level=0).one()
    assert top.title == "The Beginning"


def test_finalize_under_a_template_of_another_depth_asks_for_a_review(client):
    up = _upload(client)
    r = client.post(f"/api/import/{up['session_id']}/finalize", json={"title": "Draft", "template_id": "freeform"})
    assert r.status_code == 409


def test_the_story_keeps_its_version_as_imported(client, db_session):
    up = _upload(client)
    done = client.post(f"/api/import/{up['session_id']}/finalize", json={"title": "Draft", "template_id": "three-act"})
    assert done.status_code == 200, done.text
    snap = db_session.query(StorySnapshot).filter_by(story_id=done.json()["id"]).one()
    assert snap.name == "As imported"
