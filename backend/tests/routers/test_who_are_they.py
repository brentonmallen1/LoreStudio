"""Who are they (doc 20 R1): the fields and lists a character holds about who a person is."""

from app.models.character import Character
from app.services.snapshot_service import _dict_to_model, _model_to_dict
from tests.fixtures.findings_story import build_findings_story

H = {"X-Client-Id": "tab-who"}


def _eleanor(db, story):
    return db.query(Character).filter(Character.story_id == story.id, Character.name == "Eleanor Vance").one()


def _facet(**kw):
    return {"area": "moving", "name": "uses a cane", "page": "the cane hooked over the rail", **kw}


def test_the_fields_are_written_and_read_back(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    body = {
        "gender": "woman",
        "presentation": "androgynous",
        "stakes": "The island forgets her father",
        "facets": [_facet()],
        "formative": [{"title": "Her father's last two months", "wound": True, "notes": ["grief"]}],
    }
    r = client.patch(f"/api/characters/{eleanor.id}", json=body, headers=H)
    assert r.status_code == 200, r.text
    out = r.json()
    assert (out["gender"], out["presentation"], out["sex"]) == ("woman", "androgynous", "")
    facet = out["facets"][0]
    assert facet["id"] and facet["known"] == "everyone" and facet["assistant"] is True
    assert out["formative"][0]["known"] == "only_them"
    assert out["formative"][0]["notes"] == ["grief"]


def test_an_entry_with_an_unknown_area_is_refused_and_unknown_keys_dropped(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    r = client.patch(f"/api/characters/{eleanor.id}", json={"facets": [_facet(area="flaws")]}, headers=H)
    assert r.status_code == 422
    r = client.patch(f"/api/characters/{eleanor.id}", json={"facets": [_facet(severity=9)]}, headers=H)
    assert "severity" not in r.json()["facets"][0]


def test_an_entry_edit_undoes(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    client.patch(f"/api/characters/{eleanor.id}", json={"facets": [_facet()]}, headers=H)
    first = client.get(f"/api/characters/{eleanor.id}").json()["facets"]
    changed = [{**first[0], "page": "she leans on the rail"}]
    client.patch(f"/api/characters/{eleanor.id}", json={"facets": changed}, headers=H)
    assert client.post(f"/api/stories/{story.id}/undo", headers=H).status_code == 200
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["page"] == first[0]["page"]


def test_a_deleted_scene_or_person_leaves_no_reference_and_undo_puts_it_back(client, db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    other = db_session.query(Character).filter(Character.story_id == story.id, Character.id != eleanor.id).first()
    scene = nodes["The Storm"]
    entry = _facet(known="some", known_to=[other.id], revealed_in=scene.id)
    client.patch(f"/api/characters/{eleanor.id}", json={"facets": [entry]}, headers=H)

    assert client.delete(f"/api/structure/{scene.id}", headers=H).status_code in (200, 204)
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["revealed_in"] is None
    assert client.post(f"/api/stories/{story.id}/undo", headers=H).status_code == 200
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["revealed_in"] == scene.id

    assert client.delete(f"/api/characters/{other.id}", headers=H).status_code == 204
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["known_to"] == []
    assert client.post(f"/api/stories/{story.id}/undo", headers=H).status_code == 200
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["known_to"] == [other.id]


def test_a_deleted_compendium_entry_leaves_the_research_list(client, db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    eleanor = _eleanor(db_session, story)
    entry = client.post(f"/api/stories/{story.id}/compendium/notes", json={"title": "Canes", "content": ""}).json()
    client.patch(f"/api/characters/{eleanor.id}", json={"facets": [_facet(research=[entry["id"]])]}, headers=H)
    assert client.delete(f"/api/compendium/{entry['id']}", headers=H).status_code == 204
    assert client.get(f"/api/characters/{eleanor.id}").json()["facets"][0]["research"] == []


def test_an_old_snapshot_restores_with_empty_fields(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    row = _model_to_dict(_eleanor(db_session, story))
    old = {k: v for k, v in row.items() if k not in ("gender", "facets", "formative", "stakes", "need")}
    db_session.delete(_eleanor(db_session, story))
    db_session.flush()
    db_session.add(_dict_to_model(Character, old))
    db_session.flush()
    restored = _eleanor(db_session, story)
    assert (restored.gender, restored.facets, restored.formative, restored.stakes) == ("", [], [], "")


def test_entries_carried_into_a_sequel_point_at_that_books_people(client, db_session, test_user):
    from tests.fixtures.series_factory import make_book

    one = make_book(db_session, test_user)
    one.eleanor.facets = [
        {
            "id": "f1",
            "area": "senses",
            "name": "Deaf",
            "known": "some",
            "known_to": [one.visitor.id],
            "revealed_in": "n1",
        }
    ]
    one.visitor.formative = [{"id": "w1", "title": "The Ardent", "known": "some", "known_to": [one.eleanor.id]}]
    db_session.commit()
    body = {
        "title": "Two",
        "carry": [{"kind": "character", "ref_id": one.eleanor.id}, {"kind": "character", "ref_id": one.visitor.id}],
    }
    new = client.post(f"/api/stories/{one.story.id}/sequel", json=body).json()["id"]

    chars = {c.name: c for c in db_session.query(Character).filter(Character.story_id == new)}
    eleanor, visitor = chars["Eleanor"], chars["The Visitor"]
    assert eleanor.facets[0]["known_to"] == [visitor.id] and eleanor.facets[0]["revealed_in"] is None
    assert visitor.formative[0]["known_to"] == [eleanor.id]
