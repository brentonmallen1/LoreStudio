"""Research a series shares, kept in step; and images that travel with a character (v1.5)."""

import uuid

import pytest

from app.models import Character
from app.models.compendium import CompendiumEntry
from app.models.diagram import Diagram
from app.models.media import AssetAttachment, StoryAsset
from app.services import media_files
from app.services import snapshot_service as svc
from tests.fixtures.series_factory import empty_book, make_book


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(media_files, "UPLOADS_DIR", tmp_path)
    return tmp_path


def _asset(db, story, user, name: str, contents: bytes) -> StoryAsset:
    asset = StoryAsset(
        id=str(uuid.uuid4()),
        story_id=story.id,
        user_id=user.id,
        original_filename=name,
        stored_path="",
        mime_type="image/png",
        size_bytes=len(contents),
    )
    asset.stored_path = media_files.write_upload(story.id, asset.id, name, contents)
    db.add(asset)
    db.flush()
    return asset


def _series(client, db_session, test_user, n=2):
    books = [empty_book(db_session, test_user, f"Book {i + 1}") for i in range(n)]
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Lighthouse Years", "story_ids": [b.id for b in books]}).json()["id"]
    return sid, books


def _copies(db, model, *books):
    return [db.query(model).filter(model.story_id == b.id).one() for b in books]


def test_shared_research_is_in_every_book_and_kept_in_step(client, db_session, test_user, uploads):
    sid, (one, two) = _series(client, db_session, test_user)
    note = CompendiumEntry(story_id=one.id, title="Keepers' logs", entry_type="note", content="<p>Daily.</p>")
    db_session.add(note)
    db_session.commit()

    r = client.post(
        f"/api/series/{sid}/share", json={"kind": "compendium_entry", "story_id": one.id, "ref_id": note.id}
    )
    assert r.status_code == 200
    [el] = [e for e in r.json()["elements"] if e["kind"] == "compendium_entry"]
    assert el["synced"] is True and len(el["members"]) == 2
    mine, theirs = _copies(db_session, CompendiumEntry, one, two)
    assert theirs.title == "Keepers' logs"

    # An edit in Book 2 is Book 1's too, each book logging its own.
    assert client.patch(f"/api/compendium/{theirs.id}", json={"content": "<p>Hourly.</p>"}).status_code == 200
    db_session.expire_all()
    assert db_session.get(CompendiumEntry, mine.id).content == "<p>Hourly.</p>"
    changes = client.get(f"/api/stories/{one.id}/changes").json()
    assert any("Keep Keepers' logs in step with Book 2" in str(c) for c in changes)

    # Undone in Book 2: both go back, the other kept in step.
    assert client.post(f"/api/stories/{two.id}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.get(CompendiumEntry, theirs.id).content == "<p>Daily.</p>"
    assert db_session.get(CompendiumEntry, mine.id).content == "<p>Daily.</p>"

    [shared] = client.get(f"/api/series/{sid}/shared").json()
    assert shared["in_step"] is True and shared["missing"] == []


def test_a_book_that_joins_later_has_it_and_one_kept_apart_does_not_follow(client, db_session, test_user, uploads):
    sid, (one, two) = _series(client, db_session, test_user)
    diagram = Diagram(story_id=one.id, title="The island", nodes=[{"id": "n1", "data": {"label": "Harbour"}}], edges=[])
    db_session.add(diagram)
    db_session.commit()
    client.post(f"/api/series/{sid}/share", json={"kind": "diagram", "story_id": one.id, "ref_id": diagram.id})

    three = empty_book(db_session, test_user, "Book 3")
    db_session.commit()
    client.post(f"/api/series/{sid}/stories", json={"story_id": three.id})
    copy3 = db_session.query(Diagram).filter(Diagram.story_id == three.id).one()
    assert copy3.title == "The island" and copy3.nodes[0]["data"]["label"] == "Harbour"

    el = next(e for e in client.get(f"/api/series/{sid}").json()["elements"] if e["kind"] == "diagram")
    client.delete(f"/api/series/{sid}/elements/{el['id']}/members/{three.id}")
    client.patch(f"/api/diagrams/{diagram.id}", json={"title": "Harrow Island"})
    db_session.expire_all()
    assert db_session.get(Diagram, copy3.id).title == "The island", "kept apart"
    assert db_session.query(Diagram).filter(Diagram.story_id == two.id).one().title == "Harrow Island"


def test_a_shared_document_brings_its_own_file(client, db_session, test_user, uploads):
    sid, (one, two) = _series(client, db_session, test_user)
    pdf = _asset(db_session, one, test_user, "chart.pdf", b"%PDF chart")
    doc = CompendiumEntry(story_id=one.id, title="Admiralty chart", entry_type="document", asset_id=pdf.id)
    db_session.add(doc)
    db_session.commit()
    client.post(f"/api/series/{sid}/share", json={"kind": "compendium_entry", "story_id": one.id, "ref_id": doc.id})

    theirs = db_session.query(CompendiumEntry).filter(CompendiumEntry.story_id == two.id).one()
    their_pdf = db_session.get(StoryAsset, theirs.asset_id)
    assert their_pdf.story_id == two.id and their_pdf.stored_path != pdf.stored_path
    assert (uploads / their_pdf.stored_path).read_bytes() == b"%PDF chart"

    # Deleting Book 2's file leaves Book 1's.
    assert client.delete(f"/api/media/{their_pdf.id}").status_code == 204
    assert (uploads / pdf.stored_path).read_bytes() == b"%PDF chart"


def test_restoring_a_book_puts_every_copy_where_it_was(client, db_session, test_user, uploads):
    sid, (one, two) = _series(client, db_session, test_user)
    note = CompendiumEntry(story_id=one.id, title="Tides", entry_type="note", content="Twice a day.")
    db_session.add(note)
    db_session.commit()
    client.post(f"/api/series/{sid}/share", json={"kind": "compendium_entry", "story_id": one.id, "ref_id": note.id})
    snap = svc.create_snapshot(two.id, db_session, trigger="manual", name="before")
    snap_id = snap.id
    client.patch(f"/api/compendium/{note.id}", json={"content": "Four times a day."})

    assert client.post(f"/api/stories/{two.id}/snapshots/{snap_id}/restore", json={}).status_code == 200
    db_session.expire_all()
    assert {e.content for e in db_session.query(CompendiumEntry)} == {"Twice a day."}


def test_shared_research_has_no_field_classes(client, db_session, test_user, uploads):
    sid, _ = _series(client, db_session, test_user)
    r = client.patch(
        f"/api/series/{sid}/field-classes",
        json={"kind": "compendium_entry", "field": "title", "field_class": "evolving"},
    )
    assert r.status_code == 400


def test_a_carried_character_brings_her_portrait_as_her_own(client, db_session, test_user, uploads):
    one = make_book(db_session, test_user)
    two = empty_book(db_session, test_user, "Book Two")
    face = _asset(db_session, one.story, test_user, "eleanor.png", b"png eleanor")
    db_session.add(
        AssetAttachment(asset_id=face.id, object_type="character", object_id=one.eleanor.id, role="portrait")
    )
    db_session.commit()
    sid = client.post("/api/series", json={"name": "Keepers", "story_ids": [one.story.id, two.id]}).json()["id"]
    el = client.post(
        f"/api/series/{sid}/elements", json={"kind": "character", "story_id": one.story.id, "ref_id": one.eleanor.id}
    ).json()["elements"][0]
    client.post(f"/api/series/{sid}/elements/{el['id']}/members", json={"story_id": two.id})

    hers = db_session.query(Character).filter(Character.story_id == two.id).one()
    [att] = db_session.query(AssetAttachment).filter(AssetAttachment.object_id == hers.id).all()
    copy = db_session.get(StoryAsset, att.asset_id)
    assert att.role == "portrait" and copy.story_id == two.id and copy.stored_path != face.stored_path
    assert (uploads / copy.stored_path).read_bytes() == b"png eleanor"

    # Not kept in step: Book 2 can change her face without changing Book 1's.
    assert client.patch(f"/api/media/{copy.id}", json={"alt_text": "Older now"}).status_code == 200
    db_session.expire_all()
    assert db_session.get(StoryAsset, face.id).alt_text in (None, "")

    # Undoing bringing her in takes the portrait with her.
    client.post(f"/api/stories/{two.id}/undo")  # the caption
    assert client.post(f"/api/stories/{two.id}/undo").status_code == 200
    db_session.expire_all()
    assert db_session.query(AssetAttachment).filter(AssetAttachment.object_id == hers.id).count() == 0
    assert db_session.query(StoryAsset).filter(StoryAsset.story_id == two.id).count() == 0
