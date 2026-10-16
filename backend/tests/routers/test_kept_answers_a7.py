"""Kept answers everywhere (A7): every one-shot Assistant answer that used to be forgotten is
kept on what it is about when it comes back well, and a failed one keeps nothing.

Each case asks once with a good answer and once with a failing one, on a fresh story, and
reads `/assistant-results` for the subject it should be kept on.
"""

from collections.abc import Callable
from dataclasses import dataclass

import pytest

from app.models.assistant_result import AssistantResult
from app.models.character import Character
from app.models.media import StoryAsset
from app.models.outline import Outline
from app.models.structure import StructureNode
from tests.fixtures.story_factory import build_full_story


@dataclass
class World:
    sid: str
    hero: str
    scene: str
    outline: str
    asset: str


def _world(db, user, tmp_path, monkeypatch) -> World:
    story = build_full_story(db, user)
    story.target_audience = "adult"
    db.commit()
    hero = db.query(Character).filter_by(story_id=story.id, name="Mara").one()
    scene = db.query(StructureNode).filter_by(story_id=story.id, title="Lamp").one()
    outline = db.query(Outline).filter_by(story_id=story.id).one()
    asset = db.query(StoryAsset).filter_by(story_id=story.id).one()
    # The factory's image has no file: give it one, where the media routes will look.
    (tmp_path / "x").mkdir()
    (tmp_path / "x" / "a.png").write_bytes(b"\x89PNG fake")
    from app.routers import media

    monkeypatch.setattr(media, "_get_uploads_dir", lambda: tmp_path)
    return World(story.id, hero.id, scene.id, outline.id, asset.id)


@dataclass
class Case:
    """One feature: how to ask, and where its answer should be kept."""

    id: str
    ask: Callable[[object, World], object]
    subject: Callable[[World], tuple[str, str]]
    feature: str
    #: A good answer from the model, for a structured feature; None for a stream.
    data: dict | None = None


CASES = [
    Case(
        "voice-fidelity",
        lambda c, w: c.post(f"/api/characters/{w.hero}/analyze-voice-fidelity"),
        lambda w: ("character", w.hero),
        "voice-fidelity",
        {"overall_fidelity": "good", "summary": "Steady.", "findings": []},
    ),
    Case(
        "arc-analysis",
        lambda c, w: c.post(f"/api/characters/{w.hero}/analyze-arc"),
        lambda w: ("character", w.hero),
        "arc-analysis",
        {"overall_rating": "fair", "suggestions": ["Let her choose."]},
    ),
    Case(
        "character-arc",
        lambda c, w: c.post(f"/api/stories/{w.sid}/summarize/character", json={"character_id": w.hero}),
        lambda w: ("character", w.hero),
        "character-arc",
    ),
    Case(
        "structure-summary",
        lambda c, w: c.post(f"/api/stories/{w.sid}/summarize/structure", json={"node_id": w.scene}),
        lambda w: ("node", w.scene),
        "structure-summary",
    ),
    Case(
        "story-summary",
        lambda c, w: c.post(f"/api/stories/{w.sid}/summarize", json={}),
        lambda w: ("story", w.sid),
        "story-summary",
    ),
    Case(
        "session-recap",
        lambda c, w: c.post(f"/api/stories/{w.sid}/recap"),
        lambda w: ("story", w.sid),
        "session-recap",
    ),
    Case(
        "relationship-suggest-cast",
        lambda c, w: c.post(f"/api/stories/{w.sid}/suggest-relationships", json={}),
        lambda w: ("story", w.sid),
        "relationship-suggest",
        {"suggestions": []},
    ),
    Case(
        "relationship-suggest-one",
        lambda c, w: c.post(f"/api/stories/{w.sid}/suggest-relationships", json={"character_id": w.hero}),
        lambda w: ("character", w.hero),
        "relationship-suggest",
        {"suggestions": []},
    ),
    Case(
        "image-analysis",
        lambda c, w: c.post(f"/api/media/{w.asset}/analyze"),
        lambda w: ("image", w.asset),
        "image-analysis",
    ),
    Case(
        "character-from-image",
        lambda c, w: c.post(f"/api/media/{w.asset}/analyze/character"),
        lambda w: ("image", w.asset),
        "character-from-image",
    ),
    Case(
        "character-from-portrait",
        lambda c, w: c.post(f"/api/media/{w.asset}/analyze/character?character_id={w.hero}"),
        lambda w: ("character", w.hero),
        "character-from-image",
    ),
    Case(
        "scene-atmosphere",
        lambda c, w: c.post(
            f"/api/stories/{w.sid}/analyze/scene-atmosphere", json={"asset_ids": [w.asset], "node_id": w.scene}
        ),
        lambda w: ("node", w.scene),
        "scene-atmosphere",
    ),
    Case(
        "extract-outline",
        lambda c, w: c.post(f"/api/stories/{w.sid}/tray/from-prose"),
        lambda w: ("story", w.sid),
        "extract-outline",
        {"items": []},
    ),
    Case(
        "snowflake-guidance",
        lambda c, w: c.post(
            f"/api/stories/{w.sid}/snowflake/guidance", json={"layer": "sentence", "content": "A keeper stays."}
        ),
        lambda w: ("story", w.sid),
        "snowflake-guidance:sentence",
    ),
    Case(
        "snowflake-guidance-character",
        lambda c, w: c.post(
            f"/api/stories/{w.sid}/snowflake/guidance",
            json={"layer": "character_summary", "content": "She stays.", "character_id": w.hero},
        ),
        lambda w: ("character", w.hero),
        "snowflake-guidance:character_summary",
    ),
    Case(
        "comp-titles",
        lambda c, w: c.post(f"/api/stories/{w.sid}/publication/comp-titles"),
        lambda w: ("story", w.sid),
        "comp-titles",
        {"suggestions": [], "positioning_note": "Quiet literary."},
    ),
    Case(
        "show-dont-tell",
        lambda c, w: c.post(f"/api/stories/{w.sid}/analyze/show-dont-tell", json={"node_id": w.scene}),
        lambda w: ("node", w.scene),
        "show-dont-tell",
        {"instances": [], "overall_rating": "good"},
    ),
    Case(
        "audience-adherence",
        lambda c, w: c.post(f"/api/stories/{w.sid}/analyze/audience-adherence", json={"node_id": w.scene}),
        lambda w: ("node", w.scene),
        "audience-adherence",
        {"overall_fit": "good", "issues": []},
    ),
    Case(
        "discovery-questions",
        lambda c, w: c.post(
            f"/api/stories/{w.sid}/discovery-questions", json={"focus_area": "character", "entity_id": w.hero}
        ),
        lambda w: ("character", w.hero),
        "discovery-questions",
        {"questions": []},
    ),
    Case(
        "dialogue-attribution",
        lambda c, w: c.post(f"/api/scenes/{w.scene}/dialogue/ai-suggest"),
        lambda w: ("node", w.scene),
        "dialogue-attribution",
        {"suggestions": []},
    ),
]


def _kept(client, sid: str, subject: tuple[str, str]) -> list[dict]:
    r = client.get(f"/api/stories/{sid}/assistant-results?subject_type={subject[0]}&subject_id={subject[1]}")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_a_good_answer_is_kept_on_its_subject(
    case, client, db_session, test_user, mock_ai_gateway, tmp_path, monkeypatch
):
    w = _world(db_session, test_user, tmp_path, monkeypatch)
    mock_ai_gateway(structured_data=case.data, stream_text="The keeper stays.")
    r = case.ask(client, w)
    assert r.status_code == 200, r.text
    _ = r.content  # a stream is kept once it has been read to the end
    [kept] = [k for k in _kept(client, w.sid, case.subject(w)) if k["feature"] == case.feature]
    if case.data is None:
        assert kept["data"]["text"] == "The keeper stays."
    else:
        assert kept["data"].items() >= {k: v for k, v in case.data.items() if k != "suggestions"}.items()


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_a_failed_answer_keeps_nothing(case, client, db_session, test_user, mock_ai_gateway, tmp_path, monkeypatch):
    w = _world(db_session, test_user, tmp_path, monkeypatch)
    mock_ai_gateway(should_fail=True)
    _ = case.ask(client, w).content
    db_session.expire_all()
    assert db_session.query(AssistantResult).filter_by(story_id=w.sid).count() == 0


def test_a_passage_is_kept_with_the_words_it_was_asked_about(
    client, db_session, test_user, mock_ai_gateway, tmp_path, monkeypatch
):
    w = _world(db_session, test_user, tmp_path, monkeypatch)
    mock_ai_gateway(structured_data={"instances": []})
    body = {"node_id": w.scene, "text": "She was very sad."}
    assert client.post(f"/api/stories/{w.sid}/analyze/show-dont-tell", json=body).status_code == 200
    [kept] = _kept(client, w.sid, ("node", w.scene))
    assert kept["data"]["passage"] == "She was very sad."


def test_every_image_answer_is_read_in_one_call(client, db_session, test_user, mock_ai_gateway, tmp_path, monkeypatch):
    w = _world(db_session, test_user, tmp_path, monkeypatch)
    mock_ai_gateway(stream_text="Grey light.")
    _ = client.post(f"/api/media/{w.asset}/analyze").content
    r = client.get(f"/api/stories/{w.sid}/assistant-results?subject_type=image")
    assert [(k["subject_id"], k["feature"]) for k in r.json()] == [(w.asset, "image-analysis")]


def test_deleting_the_image_takes_its_answers(client, db_session, test_user, mock_ai_gateway, tmp_path, monkeypatch):
    w = _world(db_session, test_user, tmp_path, monkeypatch)
    mock_ai_gateway(stream_text="Grey light.")
    _ = client.post(f"/api/media/{w.asset}/analyze").content
    assert client.delete(f"/api/media/{w.asset}").status_code in (200, 204)
    db_session.expire_all()
    assert db_session.query(AssistantResult).filter_by(subject_type="image").count() == 0


def test_careful_keeps_its_word_with_the_change_it_was_asked_about(client, db_session, test_user, mock_ai_gateway):
    from tests.routers.test_character_review import _setup

    story, eleanor, storm = _setup(db_session, test_user)
    margaret = db_session.query(Character).filter_by(story_id=story.id, name="Margaret Holt").one()
    margaret.pronouns = "she/her"
    storm.content = "<p>@Eleanor Vance held the rail. @Margaret Holt watched. She was cold.</p>"
    db_session.commit()
    body = {"pronouns_from": "she/her", "pronouns_to": "they/them", "node_ids": [storm.id]}

    mock_ai_gateway(should_fail=True)
    client.post(f"/api/characters/{eleanor.id}/review/careful", json=body)
    assert _kept(client, story.id, ("character", eleanor.id)) == []

    mock_ai_gateway(structured_data={"instances": [{"exact_text": "watched. She was cold.", "target_word": "She"}]})
    out = client.post(f"/api/characters/{eleanor.id}/review/careful", json=body).json()
    [kept] = _kept(client, story.id, ("character", eleanor.id))
    assert kept["feature"] == "pronoun-identification"
    assert kept["data"]["judged"] == out["judged"]
    assert kept["data"]["request"]["pronouns_to"] == "they/them"
