"""The review step through its routes (doc 20 P3, R4): propose, apply as one change, undo it."""

from app.models.character import Character
from app.models.snapshot import StorySnapshot
from tests.fixtures.findings_story import build_findings_story

H = {"X-Client-Id": "tab-review"}


def _setup(db, user):
    story, nodes = build_findings_story(db, user)
    eleanor = db.query(Character).filter(Character.story_id == story.id, Character.name == "Eleanor Vance").one()
    for c in db.query(Character).filter(Character.story_id == story.id):
        c.pronouns = "he/him" if c.id != eleanor.id else "she/her"
    storm = nodes["The Storm"]
    storm.content = "<p>@Eleanor Vance held the rail. She was cold, and her hands shook.</p>"
    db.commit()
    return story, eleanor, storm


def test_a_pronoun_change_is_proposed_applied_and_undone_as_one(client, db_session, test_user):
    story, eleanor, storm = _setup(db_session, test_user)
    body = {"pronouns_from": "she/her", "pronouns_to": "they/them"}
    out = client.post(f"/api/characters/{eleanor.id}/review", json=body).json()
    item = next(i for i in out["items"] if i["node_id"] == storm.id and i["kind"] == "pronoun")
    assert item["sure"] and item["after"] == "They were cold, and their hands shook."

    seen = {s["node_id"]: s["updated_at"] for s in out["scenes"]}
    r = client.post(
        f"/api/characters/{eleanor.id}/review/apply",
        json={"pronouns": "they/them", "items": [item], "seen": seen},
        headers=H,
    )
    assert r.status_code == 200, r.text
    assert r.json()["applied"] == 3 and r.json()["character"]["pronouns"] == "they/them"
    db_session.refresh(storm)
    assert "They were cold, and their hands shook." in storm.content
    names = [s.name for s in db_session.query(StorySnapshot).filter(StorySnapshot.story_id == story.id)]
    assert any(n and n.startswith("Before they/them") for n in names)

    assert client.post(f"/api/stories/{story.id}/undo", headers=H).status_code == 200
    db_session.refresh(storm)
    db_session.refresh(eleanor)
    assert "She was cold, and her hands shook." in storm.content and eleanor.pronouns == "she/her"


def test_a_scene_written_in_since_the_review_is_left_alone(client, db_session, test_user):
    story, eleanor, storm = _setup(db_session, test_user)
    out = client.post(
        f"/api/characters/{eleanor.id}/review", json={"pronouns_from": "she/her", "pronouns_to": "they/them"}
    ).json()
    item = next(i for i in out["items"] if i["node_id"] == storm.id)
    r = client.post(
        f"/api/characters/{eleanor.id}/review/apply",
        json={"pronouns": "they/them", "items": [item], "seen": {storm.id: "2000-01-01T00:00:00"}},
        headers=H,
    ).json()
    assert r["applied"] == 0 and r["skipped"] == ["The Storm"]
    assert r["character"]["pronouns"] == "they/them", "the pronouns change whatever the scenes do"


def test_a_sentence_written_by_hand_is_used_instead(client, db_session, test_user):
    _story, eleanor, storm = _setup(db_session, test_user)
    out = client.post(
        f"/api/characters/{eleanor.id}/review", json={"pronouns_from": "she/her", "pronouns_to": "they/them"}
    ).json()
    item = next(i for i in out["items"] if i["node_id"] == storm.id)
    item["hand"] = "They were frozen through."
    client.post(
        f"/api/characters/{eleanor.id}/review/apply", json={"pronouns": "they/them", "items": [item]}, headers=H
    )
    db_session.refresh(storm)
    assert "held the rail. They were frozen through.</p>" in storm.content


def test_a_rename_reaches_plain_text_and_keeps_no_alias_once_nothing_says_it(client, db_session, test_user):
    _story, eleanor, storm = _setup(db_session, test_user)
    storm.content = "<p>@Eleanor Vance held the rail. Eleanor Vance was cold.</p>"
    db_session.commit()
    out = client.post(
        f"/api/characters/{eleanor.id}/review", json={"name_from": "Eleanor Vance", "name_to": "Nell Vance"}
    ).json()
    names = [i for i in out["items"] if i["kind"] == "name" and i["node_id"] == storm.id]
    assert len(names) == 2
    r = client.post(
        f"/api/characters/{eleanor.id}/review/apply", json={"name": "Nell Vance", "items": names}, headers=H
    ).json()
    db_session.refresh(storm)
    assert storm.content == "<p>@Nell Vance held the rail. Nell Vance was cold.</p>"
    assert r["character"]["name"] == "Nell Vance" and "Eleanor Vance" not in r["character"]["aliases"]


def test_any_pronouns_say_why_nothing_is_proposed(client, db_session, test_user):
    _story, eleanor, _storm = _setup(db_session, test_user)
    out = client.post(
        f"/api/characters/{eleanor.id}/review", json={"pronouns_from": "she/her", "pronouns_to": "any pronouns"}
    ).json()
    assert out["unsupported"] and not [i for i in out["items"] if i["kind"] == "pronoun"]


def test_careful_asks_only_about_unsure_scenes_and_keeps_the_rewrite_quicks(
    client, db_session, test_user, mock_ai_gateway
):
    story, eleanor, storm = _setup(db_session, test_user)
    margaret = (
        db_session.query(Character).filter(Character.story_id == story.id, Character.name == "Margaret Holt").one()
    )
    margaret.pronouns = "she/her"
    storm.content = "<p>@Eleanor Vance held the rail. @Margaret Holt watched. She was cold.</p>"
    db_session.commit()
    body = {"pronouns_from": "she/her", "pronouns_to": "they/them"}
    quick = client.post(f"/api/characters/{eleanor.id}/review", json=body).json()
    item = next(i for i in quick["items"] if i["node_id"] == storm.id and i["kind"] == "pronoun")
    assert not item["sure"], "Margaret was named nearer"

    gateway = mock_ai_gateway(
        structured_data={"instances": [{"exact_text": "watched. She was cold.", "target_word": "She"}]}
    )
    out = client.post(f"/api/characters/{eleanor.id}/review/careful", json={**body, "node_ids": [storm.id]}).json()
    assert out["judged"] == [{"item_id": item["id"], "verdict": "theirs"}]
    assert len(gateway.structured_calls) == 1
    assert gateway.structured_calls[0]["context"].feature == "pronoun-identification"
