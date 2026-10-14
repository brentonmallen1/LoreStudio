"""Tropes in play (doc 27): a stance, a why, and where the trope plays; every edit undoes."""


def _story(client, title="T") -> str:
    return client.post("/api/stories", json={"title": title}).json()["id"]


def _scene(client, sid, title="S1") -> str:
    r = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": title, "content": "<p>x</p>", "level": 0, "level_type": "scene", "position": 0},
    )
    return r.json()["id"]


def _character(client, sid, name) -> str:
    return client.post(f"/api/stories/{sid}/characters", json={"name": name}).json()["id"]


def _trope(client, sid, **body) -> dict:
    r = client.post(f"/api/stories/{sid}/tropes", json={"name": "Noble Bigot with a Badge", **body})
    assert r.status_code == 201, r.text
    return r.json()


def _get(client, sid, trope_id) -> dict | None:
    return next((t for t in client.get(f"/api/stories/{sid}/tropes").json() if t["id"] == trope_id), None)


def _undo(client, sid):
    r = client.post(f"/api/stories/{sid}/undo")
    assert r.status_code == 200, r.text


def test_a_trope_starts_undecided_and_edits_undo(client):
    sid = _story(client)
    tr = _trope(client, sid)
    assert tr["stance"] == "undecided" and tr["links"] == [] and tr["why"] == ""
    r = client.patch(f"/api/tropes/{tr['id']}", json={"stance": "subverted", "why": "Newcomb changes"})
    assert r.json()["stance"] == "subverted"
    _undo(client, sid)
    assert _get(client, sid, tr["id"])["stance"] == "undecided"
    assert client.patch(f"/api/tropes/{tr['id']}", json={"stance": "ironic"}).status_code == 422
    assert client.post(f"/api/stories/{sid}/tropes", json={"name": "  "}).status_code == 422


def test_links_play_in_one_place_each_and_undo(client):
    sid = _story(client)
    s1 = _scene(client, sid)
    richard, newcomb = _character(client, sid, "Richard"), _character(client, sid, "Newcomb")
    rel = client.post(f"/api/characters/{newcomb}/relationships", json={"related_character_id": richard}).json()
    tr = _trope(client, sid)
    both = client.post(f"/api/tropes/{tr['id']}/links", json={"character_id": newcomb, "node_id": s1})
    assert both.status_code == 422
    assert client.post(f"/api/tropes/{tr['id']}/links", json={}).status_code == 422
    on_char = client.post(f"/api/tropes/{tr['id']}/links", json={"character_id": newcomb}).json()
    client.post(f"/api/tropes/{tr['id']}/links", json={"relationship_id": rel["id"]})
    on_scene = client.post(f"/api/tropes/{tr['id']}/links", json={"node_id": s1, "note": "the line lands"}).json()
    # Placing it there again is the same link.
    assert client.post(f"/api/tropes/{tr['id']}/links", json={"character_id": newcomb}).json()["id"] == on_char["id"]
    assert len(_get(client, sid, tr["id"])["links"]) == 3
    assert [t["id"] for t in client.get(f"/api/structure/{s1}/tropes").json()] == [tr["id"]]
    # Richard carries it through the relationship.
    assert [t["id"] for t in client.get(f"/api/characters/{richard}/tropes").json()] == [tr["id"]]
    r = client.patch(f"/api/trope-links/{on_scene['id']}", json={"note": "he says it"})
    assert r.json()["note"] == "he says it"
    assert client.delete(f"/api/trope-links/{on_scene['id']}").status_code == 204
    _undo(client, sid)
    assert len(_get(client, sid, tr["id"])["links"]) == 3


def test_another_storys_scene_character_or_thread_is_refused(client):
    sid, other = _story(client), _story(client, "Other")
    foreign_scene, foreign_char = _scene(client, other), _character(client, other, "Stranger")
    foreign_thread = client.post(f"/api/stories/{other}/threads", json={"name": "Th"}).json()["id"]
    tr = _trope(client, sid)
    assert client.post(f"/api/tropes/{tr['id']}/links", json={"node_id": foreign_scene}).status_code == 422
    assert client.post(f"/api/tropes/{tr['id']}/links", json={"character_id": foreign_char}).status_code == 422
    assert client.patch(f"/api/tropes/{tr['id']}", json={"thread_id": foreign_thread}).status_code == 422
    assert _trope_refused(client, sid, definition_id="nope")


def _trope_refused(client, sid, **body) -> bool:
    return client.post(f"/api/stories/{sid}/tropes", json={"name": "X", **body}).status_code == 422


def test_deleting_a_scene_or_character_takes_its_links_and_undo_brings_them_back(client):
    sid = _story(client)
    s1 = _scene(client, sid)
    newcomb = _character(client, sid, "Newcomb")
    tr = _trope(client, sid)
    client.post(f"/api/tropes/{tr['id']}/links", json={"node_id": s1})
    client.post(f"/api/tropes/{tr['id']}/links", json={"character_id": newcomb})
    assert client.delete(f"/api/structure/{s1}").status_code == 204
    assert [lk["character_id"] for lk in _get(client, sid, tr["id"])["links"]] == [newcomb]
    _undo(client, sid)
    assert len(_get(client, sid, tr["id"])["links"]) == 2
    assert client.delete(f"/api/characters/{newcomb}").status_code == 204
    assert [lk["node_id"] for lk in _get(client, sid, tr["id"])["links"]] == [s1]
    _undo(client, sid)
    assert len(_get(client, sid, tr["id"])["links"]) == 2


def test_deleting_a_trope_takes_its_links_and_undo_brings_them_back(client):
    sid = _story(client)
    s1 = _scene(client, sid)
    tr = _trope(client, sid)
    client.post(f"/api/tropes/{tr['id']}/links", json={"node_id": s1})
    assert client.delete(f"/api/tropes/{tr['id']}").status_code == 204
    assert _get(client, sid, tr["id"]) is None
    _undo(client, sid)
    assert len(_get(client, sid, tr["id"])["links"]) == 1


def test_a_deleted_thread_or_definition_reads_as_none_and_comes_back_with_undo(client):
    sid = _story(client)
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Newcomb changes"}).json()
    entry = client.post(f"/api/stories/{sid}/compendium/notes", json={"title": "Noble Bigot", "content": "A cop"})
    assert entry.status_code == 201, entry.text
    tr = _trope(client, sid, thread_id=th["id"], definition_id=entry.json()["id"])
    assert tr["thread_id"] == th["id"] and tr["definition_id"] == entry.json()["id"]
    client.delete(f"/api/threads/{th['id']}")
    assert _get(client, sid, tr["id"])["thread_id"] is None
    _undo(client, sid)
    assert _get(client, sid, tr["id"])["thread_id"] == th["id"]
    client.delete(f"/api/compendium/{entry.json()['id']}")
    assert _get(client, sid, tr["id"])["definition_id"] is None
    _undo(client, sid)
    assert _get(client, sid, tr["id"])["definition_id"] == entry.json()["id"]


def test_reorder_lists_every_trope_once_and_undoes(client):
    sid = _story(client)
    a, b = _trope(client, sid, name="A"), _trope(client, sid, name="B")
    assert client.post(f"/api/stories/{sid}/tropes/reorder", json={"ids": [b["id"]]}).status_code == 422
    r = client.post(f"/api/stories/{sid}/tropes/reorder", json={"ids": [b["id"], a["id"]]})
    assert [t["name"] for t in r.json()] == ["B", "A"]
    assert [t["name"] for t in client.get(f"/api/stories/{sid}/tropes").json()] == ["B", "A"]
    _undo(client, sid)
    assert [t["name"] for t in client.get(f"/api/stories/{sid}/tropes").json()] == ["A", "B"]


def test_the_model_hears_the_stance_where_the_trope_plays(client, db_session):
    from app.models import Story, StructureNode
    from app.services.codex.context import _blocks_for, build_packet
    from app.services.codex.sync import sync_story

    sid = _story(client)
    s1 = client.post(
        f"/api/stories/{sid}/structure",
        json={"title": "The office", "content": "<p>@Newcomb looks up.</p>", "level": 0, "level_type": "scene"},
    ).json()["id"]
    newcomb = _character(client, sid, "Newcomb")
    th = client.post(f"/api/stories/{sid}/threads", json={"name": "Newcomb changes"}).json()
    badge = _trope(client, sid, stance="subverted", why="the one official who changes", thread_id=th["id"])
    client.post(f"/api/tropes/{badge['id']}/links", json={"character_id": newcomb})
    client.post(f"/api/tropes/{badge['id']}/links", json={"node_id": s1, "note": "he defends Richard"})
    _trope(client, sid, name="Underdog crew", stance="straight")

    packet = build_packet(db_session.get(Story, sid), db_session.get(StructureNode, s1), db_session)
    assert packet["story"]["tropes"] == ["Underdog crew — played straight"]
    (profile,) = packet["characters_in_scene"]
    assert profile["tropes"] == ["Noble Bigot with a Badge — subverted: the one official who changes"]
    (here,) = packet["tropes_in_scene"]
    assert here == {
        "name": "Noble Bigot with a Badge",
        "stance": "subverted",
        "why": "the one official who changes",
        "note": "he defends Richard",
    }
    blocks = {b.key: b for b in _blocks_for(packet)}
    assert blocks["story.tropes"].included and blocks["tropes_in_scene"].included

    sync_story(sid, db_session)
    from app.models import CodexEdge, CodexNode

    trope_node = db_session.query(CodexNode).filter_by(story_id=sid, kind="trope", ref_id=badge["id"]).one()
    kinds = sorted(e.kind for e in db_session.query(CodexEdge).filter_by(src_id=trope_node.id))
    assert kinds == ["carried_by", "plays_in", "tracked_by"]
