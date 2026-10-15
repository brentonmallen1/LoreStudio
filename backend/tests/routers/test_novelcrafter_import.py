"""A Novelcrafter export through the wizard (doc 28): upload, What comes over, finalize, the
record and its report, and what waits in Proposals › Imported. Needs pandoc for the docx."""

import pytest

from app.models import (
    AssetAttachment,
    Character,
    ChatMessage,
    ChatSession,
    CompendiumEntry,
    ImportedItem,
    Location,
    Note,
    PlotThread,
    Story,
    StoryAsset,
    StructureNode,
    Trope,
    WorldSystem,
)
from app.services import media_files
from tests.fixtures.novelcrafter import make_export, pandoc_available

pytestmark = pytest.mark.skipif(not pandoc_available(), reason="pandoc makes the test's docx")


@pytest.fixture(autouse=True)
def _templates(db_session):
    from app.models import StoryStructureTemplate
    from app.services.seed import STRUCTURE_TEMPLATES

    for t in STRUCTURE_TEMPLATES:
        if t["id"] in ("freeform", "three-act"):
            db_session.add(StoryStructureTemplate(**t, is_system=True))
    db_session.commit()


def _upload(client, data: bytes, name="2026-10-08 the-keeper - full.zip"):
    return client.post("/api/import/upload", files={"file": (name, data, "application/zip")})


def _finalize(client, up, **choices):
    r = client.post(
        f"/api/import/{up['session_id']}/finalize",
        json={"title": "The Keeper", "template_id": up["preview"]["template_id"], "novelcrafter": choices},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_the_upload_shows_what_comes_over(client):
    r = _upload(client, make_export(manuscript=True))
    assert r.status_code == 200, r.text
    up = r.json()
    assert up["source_format"] == "novelcrafter" and up["preview"]["template_id"] == "three-act"
    titles = [n["title"] for n in up["preview"]["nodes"]]
    assert "Lay of the Land" in titles and not any(t.startswith("Chapter 1:") for t in titles)
    nc = up["novelcrafter"]
    assert len(nc["entries"]) == 12 and nc["looks_like_screenplay"] is True
    assert nc["not_in_file"] and any(x["what"] == "Tags OBX" for x in nc["no_place"])


def test_every_bit_of_prose_is_a_scene(client, db_session):
    """The text before a chapter's first break, and a chapter without one, are scenes too."""
    up = _upload(client, make_export(manuscript=True)).json()
    nodes = up["preview"]["nodes"]
    assert all(n["level"] == 2 for n in nodes if n["word_count"])
    lay = next(n for n in nodes if n["title"] == "Lay of the Land" and n["level"] == 1)
    assert next(n for n in nodes if n["parent_id"] == lay["id"])["title"] == "Lay of the Land"
    sid = _finalize(client, up)["id"]
    held = db_session.query(StructureNode).filter(StructureNode.story_id == sid, StructureNode.level < 2)
    assert all(not n.content for n in held)


def test_a_zip_that_is_not_an_export_is_refused(client):
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("photo.txt", "x")
    assert _upload(client, buf.getvalue()).status_code == 415


def test_finalize_makes_the_lorebook_and_keeps_a_record(client, db_session):
    up = _upload(client, make_export(manuscript=True)).json()
    done = _finalize(client, up, entries={"r1": {"target": "merge", "merge_into": "l1"}})
    sid, rid = done["id"], done["record_id"]
    q = lambda model: db_session.query(model).filter_by(story_id=sid)  # noqa: E731

    richard = q(Character).filter_by(name="Richard Etheridge").one()
    assert richard.role == "protagonist" and richard.jungian_archetype == "hero"
    assert "goatee" in richard.appearance and richard.background == "Stoic."
    newcomb = q(Character).filter_by(name="Frank H. Newcomb").one()
    assert newcomb.thinking == "Guarded, then warmer." and newcomb.aliases == ["Newcomb", "Inspector"]
    monologue = q(Note).filter_by(about_type="character", about_id=richard.id).one()
    assert "proving it" in monologue.content
    station = q(Location).filter_by(name="Station No. 17").one()
    assert "Its history." in station.description  # the lore entry folded in
    assert q(PlotThread).one().name == "The fire at Station 17"
    trope = q(Trope).one()
    assert trope.stance == "undecided" and db_session.get(CompendiumEntry, trope.definition_id).tags == ["Trope"]
    story = db_session.get(Story, sid)
    assert "White Supremacy is flawed" in story.themes and story.logline == "A keeper rebuilds."
    urls = sorted(e.url for e in q(CompendiumEntry).filter_by(entry_type="url"))
    assert urls == [
        "https://en.wikipedia.org/wiki/Pea_Island_Life-Saving_Station",
        "https://example.org/lss",
        "https://example.org/wreck",
    ]
    assert q(Note).filter_by(kind="idea").count() == 1
    (chat,) = q(ChatSession).all()
    msgs = db_session.query(ChatMessage).filter_by(session_id=chat.id).order_by(ChatMessage.created_at).all()
    assert [m.role for m in msgs] == ["user", "assistant", "user", "assistant"] and msgs[1].model == "novelcrafter"
    assert msgs[0].created_at.year == 2024
    portrait = db_session.query(AssetAttachment).filter_by(object_id=richard.id, role="portrait").one()
    assert db_session.get(StoryAsset, portrait.asset_id).mime_type == "image/jpeg"

    (waiting,) = q(ImportedItem).all()
    assert waiting.name == "The Lifesaving Service" and waiting.status == "waiting"
    assert "Kimball" in waiting.content and waiting.tags == ["Lifesaving Service"]

    report = client.get(f"/api/stories/{sid}/imports/{rid}").json()
    assert report["source"] == "novelcrafter" and report["waiting"] == 1 and report["scenes"] > 0
    assert report["came_over"]["character"] >= 2 and report["original"]["filename"].endswith(".zip")
    assert any(x["what"].startswith("A printable copy") for x in report["left_out"])
    original = db_session.get(StoryAsset, report["original"]["asset_id"])
    assert (media_files.uploads_dir() / original.stored_path).read_bytes()[:2] == b"PK"
    assert [r["id"] for r in client.get(f"/api/stories/{sid}/imports").json()] == [rid]

    # Every entry, snippet and chat ends somewhere: a row, a waiting item, or a line that says so;
    # and every image and link the entries carried is listed too.
    assert len(report["manifest"]) == 1 + 12 + 3 + 1 + 3 + 2
    assert report["came_over"]["image"] == 3 and report["came_over"]["link"] == 2


def test_leftovers_wait_in_proposals_and_undo(client, db_session):
    up = _upload(client, make_export(manuscript=True)).json()
    sid = _finalize(client, up, entries={"r1": {"target": "later"}})["id"]
    proposals = client.get(f"/api/stories/{sid}/proposals").json()["proposals"]
    imported = [p for p in proposals if p["kind"] == "imported"]
    assert [p["subject"] for p in imported] == ["Station 17: Pea Island", "The Lifesaving Service"]
    assert imported[0]["actions"][0] == {"id": "compendium", "label": "Keep in Compendium", "primary": True}
    # Waiting quietly: the logo's badge leaves them out.
    count = client.get(f"/api/stories/{sid}/proposals/count").json()["count"]
    assert count == len(proposals) - len(imported)

    lss = imported[1]["id"]
    r = client.post(f"/api/stories/{sid}/proposals/{lss}/act", json={"action": "system"})
    assert r.status_code == 200, r.text
    system = db_session.query(WorldSystem).filter_by(story_id=sid).one()
    assert "Founded in 1871." in system.notes
    u = client.post(f"/api/stories/{sid}/undo")
    assert u.status_code == 200, u.text
    assert db_session.query(WorldSystem).filter_by(story_id=sid).count() == 0
    assert lss in {p["id"] for p in client.get(f"/api/stories/{sid}/proposals").json()["proposals"]}

    station = imported[0]["id"]
    r = client.post(f"/api/stories/{sid}/proposals/{station}/act", json={"action": "place"})
    place = db_session.get(Location, r.json()["entity_id"])
    portrait = db_session.query(AssetAttachment).filter_by(object_id=place.id, role="portrait").count()
    assert place.name == "Station 17: Pea Island" and portrait == 1

    record_id = db_session.query(ImportedItem).filter_by(story_id=sid).first().record_id
    r = client.post(f"/api/stories/{sid}/proposals/imported/{record_id}/keep")
    assert r.json() == {"settled": 1}
    assert db_session.query(CompendiumEntry).filter_by(story_id=sid, title="The Lifesaving Service").count() == 1
    assert client.post(f"/api/stories/{sid}/undo").status_code == 200
    assert db_session.query(CompendiumEntry).filter_by(story_id=sid, title="The Lifesaving Service").count() == 0

    r = client.post(f"/api/stories/{sid}/proposals/{lss}/decline")
    assert r.status_code == 204
    item = db_session.query(ImportedItem).filter_by(name="The Lifesaving Service").one()
    assert item.status == "declined"  # the row stays, so the record still says where it went


def test_a_screenplay_and_no_conversations(client, db_session):
    up = _upload(client, make_export(manuscript=True)).json()
    done = _finalize(client, up, screenplay=True, chats=False)
    story = db_session.get(Story, done["id"])
    assert story.story_format == "screenplay"
    contents = "".join(n.content or "" for n in db_session.query(StructureNode).filter_by(story_id=story.id))
    assert 'data-el="cue">NEWCOMB<' in contents and 'data-el="paren">(looking up)<' in contents
    titles = [n.title for n in db_session.query(StructureNode).filter_by(story_id=story.id)]
    # Named for its heading, not "Untitled" (pandoc curls the apostrophe).
    assert "Inspector’s Office" in titles, sorted(titles)
    assert db_session.query(ChatSession).filter_by(story_id=story.id).count() == 0
    report = client.get(f"/api/stories/{story.id}/imports/{done['record_id']}").json()
    assert any(x["what"] == "1 AI conversation" for x in report["left_out"])


def test_a_document_import_keeps_a_record_too(client):
    r = client.post(
        "/api/import/upload", files={"file": ("draft.md", b"# One\n\nWords here.\n\n# Two\n\nMore.", "text/markdown")}
    )
    up = r.json()
    done = client.post(
        f"/api/import/{up['session_id']}/finalize", json={"title": "Draft", "template_id": "freeform"}
    ).json()
    report = client.get(f"/api/stories/{done['id']}/imports/{done['record_id']}").json()
    assert report["source"] == "document" and report["original"]["filename"] == "draft.md" and report["waiting"] == 0
