"""
Chat conversations reach the Chronicle (review §1.1).

`createChronicleSession` and `addChronicleMessage` both had zero call sites, so the scene
and story assistants wrote nothing at all — while the panel offered to resume conversations
that had never been recorded. CLAUDE.md names Chronicle as "conversation history"; this is
the test that makes that true rather than aspirational.
"""

from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.story import Story
from app.models.structure import StructureNode
from app.models.user import User
from tests.fixtures.sse import answer_of, error_of, kinds_of, thinking_of


def _scene(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    node = StructureNode(
        story_id=story.id, title="The Lamp Room", level=0, level_type="scene", position=0, content="<p>Rain.</p>"
    )
    db.add(node)
    db.commit()
    return story, node


def _send(client, story, node_id, text, session_id=None):
    return client.post(
        f"/api/stories/{story.id}/chat",
        json={
            "node_id": node_id,
            "messages": [{"role": "user", "content": text}],
            "chronicle_session_id": session_id,
        },
    )


def test_a_conversation_becomes_a_chronicle_session(client, db_session, test_user, mock_ai_gateway):
    story, node = _scene(db_session, test_user)
    mock_ai_gateway(stream_text="The lamp is out.")

    response = _send(client, story, node.id, "What is wrong with this scene?")
    assert response.status_code == 200
    session_id = response.headers["X-Chronicle-Session"]

    session = db_session.query(ChatSession).filter(ChatSession.id == session_id).one()
    assert (session.context_type, session.context_id) == ("scene", node.id)
    assert session.title == "What is wrong with this scene?"

    messages = db_session.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()
    assert [(m.role, m.content) for m in messages] == [
        ("user", "What is wrong with this scene?"),
        ("assistant", "The lamp is out."),
    ]


def test_the_next_message_continues_the_same_conversation(client, db_session, test_user, mock_ai_gateway):
    story, node = _scene(db_session, test_user)
    mock_ai_gateway(stream_text="Because the keeper left.")

    first = _send(client, story, node.id, "Why?")
    session_id = first.headers["X-Chronicle-Session"]
    second = _send(client, story, node.id, "And then?", session_id=session_id)

    assert second.headers["X-Chronicle-Session"] == session_id
    assert db_session.query(ChatSession).count() == 1
    assert db_session.query(ChatMessage).filter(ChatMessage.session_id == session_id).count() == 4


def test_a_story_level_chat_is_recorded_against_the_story(client, db_session, test_user, mock_ai_gateway):
    """`__story__` is not a scene; it must not be filed as one."""
    story, _ = _scene(db_session, test_user)
    mock_ai_gateway(stream_text="Themes so far…")

    response = _send(client, story, "__story__", "What themes are emerging?")
    session = db_session.query(ChatSession).filter(ChatSession.id == response.headers["X-Chronicle-Session"]).one()
    assert session.context_type == "story"
    assert session.context_label == story.title


def test_someone_elses_session_id_does_not_append_to_their_conversation(client, db_session, test_user, mock_ai_gateway):
    """A stale or forged id starts a new conversation rather than writing into another."""
    story, node = _scene(db_session, test_user)
    mock_ai_gateway(stream_text="ok")
    someone_else = User(username="mara", password_hash="x", display_name="Mara")
    db_session.add(someone_else)
    db_session.flush()
    intruder = ChatSession(story_id=story.id, user_id=someone_else.id, context_type="scene", context_id=node.id)
    db_session.add(intruder)
    db_session.commit()

    response = _send(client, story, node.id, "Hello", session_id=intruder.id)
    assert response.headers["X-Chronicle-Session"] != intruder.id
    assert db_session.query(ChatMessage).filter(ChatMessage.session_id == intruder.id).count() == 0


def test_a_rejected_message_shape_never_reaches_the_provider(client, db_session, test_user):
    """The endpoint took `list[dict]`, so a bad history failed somewhere less obvious."""
    story, node = _scene(db_session, test_user)
    response = client.post(
        f"/api/stories/{story.id}/chat",
        json={"node_id": node.id, "messages": [{"role": "narrator", "content": "hi"}]},
    )
    assert response.status_code == 422
    assert db_session.query(ChatSession).count() == 0


def test_reasoning_never_reaches_the_answer_or_the_chronicle(client, db_session, test_user, mock_ai_gateway):
    """
    Gemma delimits its reasoning inside the token stream. It used to travel all the way
    into the stored message, and four React components each stripped it back out on the
    way to the screen. Now it has its own event and never joins the prose.
    """
    story, node = _scene(db_session, test_user)
    mock_ai_gateway(stream_text="<|channel>thought\nthe lamp matters<channel|>The lamp is out.")

    response = _send(client, story, node.id, "What is wrong?")
    assert answer_of(response) == "The lamp is out."
    assert thinking_of(response) == "the lamp matters"

    session_id = response.headers["X-Chronicle-Session"]
    stored = (
        db_session.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.role == "assistant")
        .one()
    )
    assert stored.content == "The lamp is out."


def test_a_failed_call_arrives_as_an_error_event_and_is_not_stored_as_an_answer(
    client, db_session, test_user, mock_ai_gateway
):
    """
    The transport has already committed to 200 by the time the model fails. The failure
    used to be appended as prose, indistinguishable from something the model said.
    """
    story, node = _scene(db_session, test_user)
    mock_ai_gateway(should_fail=True, error_message="ollama refused the connection")

    response = _send(client, story, node.id, "Why?")
    assert response.status_code == 200
    assert kinds_of(response) == ["error", "done"]
    assert answer_of(response) == ""

    message = error_of(response)
    assert message and "went wrong" in message
    # The exception text stays in the log rather than being rendered into the manuscript.
    assert "ollama refused" not in message

    session_id = response.headers["X-Chronicle-Session"]
    roles = [m.role for m in db_session.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()]
    assert roles == ["user"]
