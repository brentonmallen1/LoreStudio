"""
Integration tests for AI analysis endpoints.

POST /api/stories/{id}/analyze/economy             — story economy analysis
POST /api/stories/{id}/analyze/essential-questions — essential questions
POST /api/stories/{id}/analyze/show-dont-tell      — show don't tell
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.story import Story
from app.models.structure import StructureNode
from app.models.character import Character
from app.models.plot_thread import PlotThread
from tests.fixtures.ai_fixtures import (
    SAMPLE_ECONOMY_ANALYSIS,
    SAMPLE_ESSENTIAL_QUESTIONS,
    SAMPLE_SHOW_DONT_TELL,
)


def _story(user_id: str, **kwargs) -> Story:
    return Story(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=kwargs.get("title", "Test Story"),
        intent=kwargs.get("intent", "A story about resilience"),
        genre=kwargs.get("genre", "literary fiction"),
        target_audience=kwargs.get("target_audience", "general"),
        narrative_intent=kwargs.get("narrative_intent", "Explore loss and renewal"),
    )


def _scene(story_id: str, content: str = "Scene content here.", title: str = "Scene 1") -> StructureNode:
    return StructureNode(
        id=str(uuid.uuid4()),
        story_id=story_id,
        title=title,
        level=1,
        level_type="scene",
        position=0,
        status="draft",
        word_count=len(content.split()),
        content=content,
        content_summary="A brief summary.",
    )


def _character(story_id: str, name: str = "Maya") -> Character:
    return Character(
        id=str(uuid.uuid4()),
        story_id=story_id,
        name=name,
        role="protagonist",
        motivation="Find her missing brother.",
    )


class TestEconomyAnalysis:
    def test_returns_analysis_on_success(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(structured_data=SAMPLE_ECONOMY_ANALYSIS)
        story = _story(test_user.id)
        scene = _scene(story.id)
        db_session.add_all([story, scene])
        db_session.commit()

        response = client.post(f"/api/stories/{story.id}/analyze/economy")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "thread_balance" in data["data"]

    def test_returns_failure_result_when_ai_fails(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(should_fail=True)
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.post(f"/api/stories/{story.id}/analyze/economy")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False

    def test_returns_404_for_unknown_story(self, client: TestClient, mock_ai_gateway):
        mock_ai_gateway(structured_data=SAMPLE_ECONOMY_ANALYSIS)
        response = client.post("/api/stories/does-not-exist/analyze/economy")
        assert response.status_code == 404

    def test_gateway_called_with_correct_feature(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        gw = mock_ai_gateway(structured_data=SAMPLE_ECONOMY_ANALYSIS)
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        client.post(f"/api/stories/{story.id}/analyze/economy")

        assert len(gw.structured_calls) == 1
        assert gw.structured_calls[0]["context"].feature == "economy-analysis"
        assert gw.structured_calls[0]["context"].story_id == story.id


class TestEssentialQuestionsAnalysis:
    def test_returns_analysis(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(structured_data=SAMPLE_ESSENTIAL_QUESTIONS)
        story = _story(test_user.id)
        char = _character(story.id)
        scene = _scene(story.id)
        db_session.add_all([story, char, scene])
        db_session.commit()

        response = client.post(f"/api/stories/{story.id}/analyze/essential-questions")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "protagonist" in data["data"]

    def test_returns_422_when_no_characters(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        """The endpoint requires at least one character to analyze."""
        mock_ai_gateway(structured_data=SAMPLE_ESSENTIAL_QUESTIONS)
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.post(f"/api/stories/{story.id}/analyze/essential-questions")
        assert response.status_code == 422


class TestShowDontTellAnalysis:
    def test_returns_instances_with_text_body(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(structured_data=SAMPLE_SHOW_DONT_TELL)
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.post(
            f"/api/stories/{story.id}/analyze/show-dont-tell",
            json={"text": "She was very angry. He felt sad and defeated."},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "instances" in data["data"]

    def test_returns_instances_with_node_id(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(structured_data=SAMPLE_SHOW_DONT_TELL)
        story = _story(test_user.id)
        scene = _scene(story.id, content="She was very angry. He felt sad.")
        db_session.add_all([story, scene])
        db_session.commit()

        response = client.post(
            f"/api/stories/{story.id}/analyze/show-dont-tell",
            json={"node_id": scene.id},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_returns_422_when_no_text_or_node(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway()
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.post(f"/api/stories/{story.id}/analyze/show-dont-tell")
        assert response.status_code == 422

    def test_returns_failure_gracefully_with_text(
        self, client: TestClient, db_session: Session, test_user, mock_ai_gateway
    ):
        mock_ai_gateway(should_fail=True)
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.post(
            f"/api/stories/{story.id}/analyze/show-dont-tell",
            json={"text": "She felt very sad."},
        )
        assert response.status_code == 200
        assert response.json()["success"] is False
