"""
The rail badge (GET /api/stories/{story_id}/health/alerts): the count of open findings.

The Story Health dashboard (GET /health) is gone (doc 12 P6); its numbers are the
Overview's and its checks are the findings feed's, tested there.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.plot_thread import PlotThread
from app.models.story import Story
from app.models.structure import StructureNode


def _story(user_id: str) -> Story:
    return Story(id=str(uuid.uuid4()), user_id=user_id, title="Test Story", intended_length="novel")


def _scene(story_id: str, title: str, position: int) -> StructureNode:
    return StructureNode(
        id=str(uuid.uuid4()),
        story_id=story_id,
        title=title,
        level=1,
        level_type="scene",
        position=position,
        word_count=100,
        content="",
    )


def test_alerts_count_open_findings_including_crossing_threads(client: TestClient, db_session: Session, test_user):
    """Two MICE threads that cross instead of nesting are a finding, and the badge counts it."""
    story = _story(test_user.id)
    db_session.add(story)
    a, b, c, d = (_scene(story.id, f"Scene {x}", i) for i, x in enumerate("ABCD"))
    db_session.add_all([a, b, c, d])
    db_session.add_all(
        [
            PlotThread(story_id=story.id, name="One", status="open", mice_type="milieu",
                       opens_at_node_id=a.id, closes_at_node_id=c.id),
            PlotThread(story_id=story.id, name="Two", status="open", mice_type="idea",
                       opens_at_node_id=b.id, closes_at_node_id=d.id),
        ]
    )  # fmt: skip
    db_session.commit()

    alerts = client.get(f"/api/stories/{story.id}/health/alerts").json()
    assert alerts["mice_violation_count"] > 0
    feed = client.get(f"/api/stories/{story.id}/findings").json()
    assert alerts["count"] == feed["open_count"]
    assert any(f["check"] == "mice_nesting" for f in feed["findings"])


def test_alerts_returns_404_for_unknown_story(client: TestClient):
    assert client.get("/api/stories/does-not-exist/health/alerts").status_code == 404


def test_the_dashboard_endpoint_is_gone(client: TestClient, db_session: Session, test_user):
    story = _story(test_user.id)
    db_session.add(story)
    db_session.commit()
    assert client.get(f"/api/stories/{story.id}/health").status_code == 404
