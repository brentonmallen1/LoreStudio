"""
A conversation keeps its Think first choice (Chronicle's record of it), so a conversation
resumed after a reload, or on another device, thinks as the author left it.
"""

from app.models.story import Story


def _conversation(client, db_session, test_user) -> dict:
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.commit()
    made = client.post("/api/chronicle/sessions", json={"story_id": story.id, "context_type": "scene"})
    assert made.status_code in (200, 201), made.text
    return made.json()


def test_the_choice_is_kept_and_can_be_cleared(client, db_session, test_user):
    conversation = _conversation(client, db_session, test_user)
    assert conversation["thinking"] is None  # follows its default

    url = f"/api/chronicle/sessions/{conversation['id']}"
    assert client.patch(url, json={"thinking": True}).json()["thinking"] is True
    assert client.get(url).json()["thinking"] is True
    assert client.patch(url, json={"title": "Eleanor's fear"}).json()["thinking"] is True  # untouched

    fork = client.post(f"{url}/fork").json()
    assert fork["thinking"] is True

    assert client.patch(url, json={"thinking": None}).json()["thinking"] is None
