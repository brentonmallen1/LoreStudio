"""Interviews and group interviews as Chronicle conversations (doc 13 P1).

Cleared and compacted on the server, where their history lives; mirrored into the Chronicle,
where deleting the live transcript deletes the conversation and deleting an old one does not.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.chat_session import ChatSession
from app.models.interview import CharacterInterview
from app.models.panel_interview import PanelInterview
from app.models.story import Story


def _cast(db: Session, user_id: str) -> tuple[Story, Character, Character]:
    story = Story(id=str(uuid.uuid4()), user_id=user_id, title="Test Story")
    a = Character(id=str(uuid.uuid4()), story_id=story.id, name="Maya")
    b = Character(id=str(uuid.uuid4()), story_id=story.id, name="Tom")
    db.add_all([story, a, b])
    db.commit()
    return story, a, b


def _lines(n: int) -> list[dict]:
    return [
        {
            "role": "user" if i % 2 == 0 else "character",
            "content": f"line {i}",
            "timestamp": "t",
            "character_name": "Maya",
        }
        for i in range(n)
    ]


def _sessions(db: Session, context_type: str, context_id: str) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.context_type == context_type, ChatSession.context_id == context_id)
        .all()
    )


class TestInterviews:
    def test_messages_are_mirrored_into_the_chronicle(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(stream_text="I keep the light.")
        _, maya, _ = _cast(db_session, test_user.id)
        interview = CharacterInterview(id=str(uuid.uuid4()), character_id=maya.id, title="T", messages=[])
        db_session.add(interview)
        db_session.commit()

        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Who are you?"})

        [session] = _sessions(db_session, "interview", interview.id)
        assert session.title == "Interview with Maya"
        assert [m.role for m in session.messages] == ["user", "assistant"]

    def test_clear_empties_history_and_archives_the_transcript(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        _, maya, _ = _cast(db_session, test_user.id)
        interview = CharacterInterview(
            id=str(uuid.uuid4()),
            character_id=maya.id,
            title="T",
            messages=[],
            compacted_summary="Earlier",
            compaction_count=1,
            interview_notes="She lies about the boat.",
        )
        db_session.add(interview)
        db_session.commit()
        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Hello"})

        res = client.post(f"/api/interviews/{interview.id}/clear")

        assert res.status_code == 200
        body = res.json()
        assert body["messages"] == []
        assert body["compacted_summary"] is None
        assert body["interview_notes"] == "She lies about the boat."
        [old] = _sessions(db_session, "interview", interview.id)
        db_session.refresh(old)
        assert old.archived is True

        # The next message opens a new transcript beside the archived one.
        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Again"})
        assert len(_sessions(db_session, "interview", interview.id)) == 2

    def test_deleting_the_live_transcript_deletes_the_interview(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        _, maya, _ = _cast(db_session, test_user.id)
        interview = CharacterInterview(id=str(uuid.uuid4()), character_id=maya.id, title="T", messages=[])
        db_session.add(interview)
        db_session.commit()
        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Hello"})
        [session] = _sessions(db_session, "interview", interview.id)

        assert client.delete(f"/api/chronicle/sessions/{session.id}").status_code == 204

        db_session.expire_all()
        assert db_session.get(CharacterInterview, interview.id) is None

    def test_deleting_an_archived_transcript_keeps_the_interview(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        _, maya, _ = _cast(db_session, test_user.id)
        interview = CharacterInterview(id=str(uuid.uuid4()), character_id=maya.id, title="T", messages=[])
        db_session.add(interview)
        db_session.commit()
        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Hello"})
        client.post(f"/api/interviews/{interview.id}/clear")
        [archived] = _sessions(db_session, "interview", interview.id)

        assert client.delete(f"/api/chronicle/sessions/{archived.id}").status_code == 204

        db_session.expire_all()
        assert db_session.get(CharacterInterview, interview.id) is not None

    def test_deleting_the_interview_deletes_its_transcripts(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        _, maya, _ = _cast(db_session, test_user.id)
        interview = CharacterInterview(id=str(uuid.uuid4()), character_id=maya.id, title="T", messages=[])
        db_session.add(interview)
        db_session.commit()
        client.post(f"/api/interviews/{interview.id}/messages", json={"content": "Hello"})

        assert client.delete(f"/api/interviews/{interview.id}").status_code == 204

        assert _sessions(db_session, "interview", interview.id) == []


class TestGroupInterviews:
    def _panel(self, db: Session, story: Story, a: Character, b: Character, messages: list[dict]) -> PanelInterview:
        panel = PanelInterview(
            id=str(uuid.uuid4()), story_id=story.id, title="Panel", character_ids=[a.id, b.id], messages=messages
        )
        db.add(panel)
        db.add(
            ChatSession(story_id=story.id, user_id=story.user_id, context_type="panel", context_id=panel.id, title="P")
        )
        db.commit()
        return panel

    def test_clear(self, client: TestClient, db_session: Session, test_user):
        story, a, b = _cast(db_session, test_user.id)
        panel = self._panel(db_session, story, a, b, _lines(4))

        res = client.post(f"/api/panels/{panel.id}/clear")

        assert res.status_code == 200
        assert res.json()["messages"] == []
        [session] = _sessions(db_session, "panel", panel.id)
        db_session.refresh(session)
        assert session.archived is True

    def test_compact_folds_older_lines_into_a_summary(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        gateway = mock_ai_gateway(stream_text="Maya and Tom argued about the boat.")
        story, a, b = _cast(db_session, test_user.id)
        panel = self._panel(db_session, story, a, b, _lines(12))

        res = client.post(f"/api/panels/{panel.id}/compact")

        assert res.status_code == 200
        messages = res.json()["messages"]
        assert messages[0]["role"] == "summary"
        assert messages[0]["content"] == "Maya and Tom argued about the boat."
        assert [m["content"] for m in messages[1:]] == [f"line {i}" for i in range(6, 12)]
        assert gateway.stream_calls[0]["context"].feature == "panel-compaction"

    def test_compact_needs_a_long_enough_conversation(self, client: TestClient, db_session: Session, test_user):
        story, a, b = _cast(db_session, test_user.id)
        panel = self._panel(db_session, story, a, b, _lines(4))

        assert client.post(f"/api/panels/{panel.id}/compact").status_code == 400

    def test_deleting_the_live_transcript_deletes_the_panel(self, client: TestClient, db_session: Session, test_user):
        story, a, b = _cast(db_session, test_user.id)
        panel = self._panel(db_session, story, a, b, _lines(2))
        [session] = _sessions(db_session, "panel", panel.id)

        assert client.delete(f"/api/chronicle/sessions/{session.id}").status_code == 204

        db_session.expire_all()
        assert db_session.get(PanelInterview, panel.id) is None
