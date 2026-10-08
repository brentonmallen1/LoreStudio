"""
Integration tests for character interview endpoints.

POST /api/interviews/characters/{character_id}  — start interview
POST /api/interviews/{id}/messages              — send message (streaming)
GET  /api/interviews/{id}                       — get interview
POST /api/interviews/{id}/summarize             — summarize (streaming)
POST /api/interviews/{id}/compact               — compact old messages
DELETE /api/interviews/{id}                     — delete
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.interview import CharacterInterview
from app.models.story import Story
from tests.fixtures.sse import answer_of


def _story(user_id: str) -> Story:
    return Story(id=str(uuid.uuid4()), user_id=user_id, title="Test Story")


def _character(story_id: str, name: str = "Maya") -> Character:
    return Character(id=str(uuid.uuid4()), story_id=story_id, name=name)


def _interview(character_id: str, messages: list | None = None) -> CharacterInterview:
    return CharacterInterview(
        id=str(uuid.uuid4()),
        character_id=character_id,
        title="Test Interview",
        messages=messages or [],
    )


class TestStartInterview:
    def test_creates_interview(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        char = _character(story.id)
        db_session.add_all([story, char])
        db_session.commit()

        response = client.post(f"/api/interviews/characters/{char.id}", json={"title": "My Interview"})
        assert response.status_code == 201
        data = response.json()
        assert data["character_id"] == char.id
        assert data["title"] == "My Interview"
        assert data["messages"] == []

    def test_creates_interview_with_default_title(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        char = _character(story.id, name="Lena")
        db_session.add_all([story, char])
        db_session.commit()

        response = client.post(f"/api/interviews/characters/{char.id}", json={})
        assert response.status_code == 201
        assert "Lena" in response.json()["title"]

    def test_returns_404_for_unknown_character(self, client: TestClient):
        response = client.post("/api/interviews/characters/does-not-exist", json={})
        assert response.status_code == 404

    def test_requires_auth(self, db_session: Session, test_user):
        from app.database import get_db
        from app.main import app

        story = _story(test_user.id)
        char = _character(story.id)
        db_session.add_all([story, char])
        db_session.commit()

        def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            # No `with`: the lifespan would migrate and seed the real database.
            response = TestClient(app).post(f"/api/interviews/characters/{char.id}", json={})
            assert response.status_code == 401
        finally:
            app.dependency_overrides.clear()


class TestGetInterview:
    def test_returns_interview(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.get(f"/api/interviews/{interview.id}")
        assert response.status_code == 200
        assert response.json()["id"] == interview.id

    def test_returns_404_for_unknown_interview(self, client: TestClient):
        response = client.get("/api/interviews/does-not-exist")
        assert response.status_code == 404


class TestSendMessage:
    def test_streams_response(self, client: TestClient, db_session: Session, test_user, mock_ai_gateway):
        mock_ai_gateway(stream_text="Hello from the character!")
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.post(
            f"/api/interviews/{interview.id}/messages",
            json={"content": "What is your name?"},
        )
        assert response.status_code == 200
        assert answer_of(response) == "Hello from the character!"

    def test_persists_user_message(self, client: TestClient, db_session: Session, test_user, mock_ai_gateway):
        mock_ai_gateway()
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        client.post(
            f"/api/interviews/{interview.id}/messages",
            json={"content": "Tell me about yourself."},
        )

        db_session.refresh(interview)
        messages = interview.messages
        user_msgs = [m for m in messages if m["role"] == "user"]
        assert len(user_msgs) >= 1
        assert user_msgs[-1]["content"] == "Tell me about yourself."

    def test_persists_assistant_response(self, client: TestClient, db_session: Session, test_user, mock_ai_gateway):
        mock_ai_gateway(stream_text="I am Maya, a lighthouse keeper.")
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        client.post(
            f"/api/interviews/{interview.id}/messages",
            json={"content": "Who are you?"},
        )

        db_session.refresh(interview)
        messages = interview.messages
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) >= 1
        assert "Maya" in assistant_msgs[-1]["content"]

    def test_returns_404_for_unknown_interview(self, client: TestClient, mock_ai_gateway):
        mock_ai_gateway()
        response = client.post(
            "/api/interviews/does-not-exist/messages",
            json={"content": "Hello?"},
        )
        assert response.status_code == 404

    def test_gateway_called_with_character_context(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        gw = mock_ai_gateway()
        story = _story(test_user.id)
        char = _character(story.id, name="Zara")
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        client.post(
            f"/api/interviews/{interview.id}/messages",
            json={"content": "Hello."},
        )

        assert len(gw.stream_calls) >= 1
        call = gw.stream_calls[-1]
        assert call["context"].feature == "interview"
        assert call["context"].character_id == char.id


class TestSummarizeInterview:
    def test_streams_summary(self, client: TestClient, db_session: Session, test_user, mock_ai_gateway):
        mock_ai_gateway(stream_text="Summary: Maya is thoughtful and guarded.")
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(
            char.id,
            messages=[
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there"},
            ],
        )
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.post(f"/api/interviews/{interview.id}/summarize")
        assert response.status_code == 200
        assert "Maya" in answer_of(response)

    def test_persists_notes(self, client: TestClient, db_session: Session, test_user, mock_ai_gateway):
        mock_ai_gateway(stream_text="Character notes: brave.")
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(
            char.id,
            messages=[
                {"role": "user", "content": "Q"},
                {"role": "assistant", "content": "A"},
            ],
        )
        db_session.add_all([story, char, interview])
        db_session.commit()

        client.post(f"/api/interviews/{interview.id}/summarize")

        db_session.refresh(interview)
        assert interview.interview_notes == "Character notes: brave."

    def test_empty_interview_streams_a_no_messages_answer(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id, messages=[])
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.post(f"/api/interviews/{interview.id}/summarize")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert answer_of(response) == "No messages to summarize."


class TestCompactInterview:
    def test_compaction_requires_enough_messages(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        story = _story(test_user.id)
        char = _character(story.id)
        # Only 3 messages — below the 10 threshold
        interview = _interview(char.id, messages=[{"role": "user", "content": f"msg {i}"} for i in range(3)])
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.post(f"/api/interviews/{interview.id}/compact")
        assert response.status_code == 400
        assert "messages to compact" in response.json()["detail"]

    def test_compaction_reduces_message_count(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(stream_text="Compacted: early conversation about names and backstory.")
        story = _story(test_user.id)
        char = _character(story.id)
        # 12 messages — above threshold
        messages = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i}"} for i in range(12)]
        interview = _interview(char.id, messages=messages)
        db_session.add_all([story, char, interview])
        db_session.commit()

        response = client.post(f"/api/interviews/{interview.id}/compact")
        assert response.status_code == 200
        data = response.json()
        # Should keep only COMPACT_KEEP=6 most recent messages
        assert len(data["messages"]) == 6


class TestDeleteInterview:
    def test_deletes_interview(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        char = _character(story.id)
        interview = _interview(char.id)
        db_session.add_all([story, char, interview])
        db_session.commit()

        interview_id = interview.id
        response = client.delete(f"/api/interviews/{interview_id}")
        assert response.status_code == 204

        # Confirm it's gone
        response = client.get(f"/api/interviews/{interview_id}")
        assert response.status_code == 404
