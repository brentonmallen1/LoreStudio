"""
Integration tests for the story health dashboard endpoints.

GET /api/stories/{story_id}/health
GET /api/stories/{story_id}/health/alerts

These endpoints are pure data — no AI involved — so no mocking needed.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.plot_thread import PlotThread
from app.models.story import Story
from app.models.structure import StructureNode


def _story(user_id: str, **kwargs) -> Story:
    return Story(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=kwargs.get("title", "Test Story"),
        intended_length=kwargs.get("intended_length", "novel"),
    )


def _scene(story_id: str, **kwargs) -> StructureNode:
    return StructureNode(
        id=str(uuid.uuid4()),
        story_id=story_id,
        title=kwargs.get("title", "Scene 1"),
        level=kwargs.get("level", 1),
        level_type=kwargs.get("level_type", "scene"),
        position=kwargs.get("position", 0),
        status=kwargs.get("status", "draft"),
        word_count=kwargs.get("word_count", 100),
        content=kwargs.get("content", ""),
    )


class TestStoryHealthEndpoint:
    def test_health_requires_auth(self, db_session: Session, test_user):
        """Unauthenticated request returns 401."""
        from app.database import get_db
        from app.main import app

        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            with TestClient(app) as c:
                response = c.get(f"/api/stories/{story.id}/health")
            assert response.status_code == 401
        finally:
            app.dependency_overrides.clear()

    def test_health_returns_word_count(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id, intended_length="novel")
        db_session.add(story)
        scene = _scene(story.id, word_count=500)
        db_session.add(scene)
        db_session.commit()

        response = client.get(f"/api/stories/{story.id}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["word_count"]["total"] == 500
        assert "target" in data["word_count"]

    def test_health_returns_empty_for_no_scenes(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.get(f"/api/stories/{story.id}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["word_count"]["total"] == 0
        assert data["scenes"]["total"] == 0
        assert data["mice_violations"] == []

    def test_health_returns_404_for_unknown_story(self, client: TestClient):
        response = client.get("/api/stories/does-not-exist/health")
        assert response.status_code == 404

    def test_health_returns_thread_health(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        db_session.add(story)
        thread = PlotThread(
            id=str(uuid.uuid4()),
            story_id=story.id,
            name="Main Thread",
            status="open",
            mice_type="milieu",
        )
        db_session.add(thread)
        db_session.commit()

        response = client.get(f"/api/stories/{story.id}/health")
        assert response.status_code == 200
        data = response.json()
        assert len(data["threads"]["open"]) == 1
        assert data["threads"]["open"][0]["name"] == "Main Thread"

    def test_health_mice_violations_detected(self, client: TestClient, db_session: Session, test_user):
        """Two threads with crossing open/close scene assignments produce violations."""
        story = _story(test_user.id)
        db_session.add(story)
        scene_a = _scene(story.id, title="Scene A", position=0)
        scene_b = _scene(story.id, title="Scene B", position=1)
        scene_c = _scene(story.id, title="Scene C", position=2)
        scene_d = _scene(story.id, title="Scene D", position=3)
        db_session.add_all([scene_a, scene_b, scene_c, scene_d])
        db_session.commit()

        # Thread 1 opens at A, closes at C (valid outer)
        # Thread 2 opens at B, closes at D (valid inner — but actually this is fine nesting)
        # To create a violation: Thread 1 opens at A, closes at C; Thread 2 opens at B, closes at D is fine
        # For a real violation: T1 opens A closes C, T2 opens B closes D — this would be a crossing
        thread1 = PlotThread(
            id=str(uuid.uuid4()),
            story_id=story.id,
            name="Thread One",
            status="open",
            mice_type="milieu",
            opens_at_node_id=scene_a.id,
            closes_at_node_id=scene_c.id,
        )
        thread2 = PlotThread(
            id=str(uuid.uuid4()),
            story_id=story.id,
            name="Thread Two",
            status="open",
            mice_type="idea",
            opens_at_node_id=scene_b.id,
            closes_at_node_id=scene_d.id,
        )
        db_session.add_all([thread1, thread2])
        db_session.commit()

        response = client.get(f"/api/stories/{story.id}/health")
        assert response.status_code == 200
        data = response.json()
        # Crossing threads should produce violations
        assert len(data["mice_violations"]) > 0


class TestStoryHealthAlertsEndpoint:
    def test_alerts_returns_count(self, client: TestClient, db_session: Session, test_user):
        story = _story(test_user.id)
        db_session.add(story)
        db_session.commit()

        response = client.get(f"/api/stories/{story.id}/health/alerts")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "absent_characters" in data
        assert "mice_violation_count" in data

    def test_alerts_returns_404_for_unknown_story(self, client: TestClient):
        response = client.get("/api/stories/does-not-exist/health/alerts")
        assert response.status_code == 404
