"""
Replies in flight, from the server (doc 21 follow-up).

The Jobs list used to read a window's own memory for the replies it was streaming, so a reply
in a popped-out panel could not be stopped from the main window, and a summary there was not
listed at all. The gate now keeps the replies in flight: Jobs lists them in every window, Stop
reaches a stream from any of them, and the job waiting names the reply it waits for.
"""

import asyncio
import uuid

import pytest

from app.models.activity_log import ActivityLog
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.llm.gate import model_gate
from app.services.llm.gateway import AICallContext, AIGateway


class SlowModel:
    """A model that writes a word every 10 ms, and notes when its stream is closed."""

    model = "fake"
    keep_alive = "5m"

    def __init__(self) -> None:
        self.closed = False

    async def get_context_length(self, model, url):
        return None

    async def chat_stream_with_metrics(self, *args, **kwargs):
        try:
            for i in range(200):
                await asyncio.sleep(0.01)
                yield f"word{i} "
        finally:
            self.closed = True


@pytest.fixture
def scene(db_session, test_user) -> StructureNode:
    story = Story(title="Lighthouse", user_id=test_user.id)
    db_session.add(story)
    db_session.flush()
    node = StructureNode(
        id=str(uuid.uuid4()), story_id=story.id, title="The Gap", level=0, level_type="scene", position=0
    )
    db_session.add(node)
    db_session.commit()
    return node


@pytest.mark.anyio
async def test_a_reply_is_listed_by_name_and_stopped_from_anywhere(db_session, test_user, scene):
    model = SlowModel()
    gateway = AIGateway(provider=model)
    context = AICallContext(feature="scene-chat", user_id=test_user.id, story_id=scene.story_id, node_id=scene.id)
    words: list[str] = []

    async def read():
        async for token in gateway.stream(
            messages=[{"role": "user", "content": "What is she hiding?"}],
            feature_prompt="Talk about the scene.",
            context=context,
            db=db_session,
            user=test_user,
        ):
            words.append(token)

    reading = asyncio.ensure_future(read())
    await asyncio.sleep(0.05)

    (call,) = model_gate.calls(test_user.id)
    assert call.label == "Scene Assistant · The Gap" and call.can_stop
    assert model_gate.waiting_reason(user_id=test_user.id) == "Waiting: Scene Assistant · The Gap goes first"
    assert model_gate.waiting_reason(user_id="someone-else") == "Waiting: a reply goes first"
    assert not model_gate.stop(call.id, "someone-else")

    assert model_gate.stop(call.id, test_user.id)
    await asyncio.wait_for(reading, 2)
    assert 0 < len(words) < 200 and model.closed
    assert model_gate.calls(test_user.id) == []

    logged = db_session.query(ActivityLog).filter(ActivityLog.category == "ai").one()
    assert logged.metadata_["status"] == "cancelled" and logged.metadata_["error"] == "Stopped from Jobs"


def test_the_list_and_stop_endpoints(client, test_user):
    async def hold():
        async with model_gate.live(user_id=test_user.id, label="Character Interview · Eleanor", can_stop=True):
            listed = client.get("/api/jobs/live").json()
            assert [c["label"] for c in listed] == ["Character Interview · Eleanor"]
            assert client.post(f"/api/jobs/live/{listed[0]['id']}/stop").json() == {"stopped": True}
            assert client.post("/api/jobs/live/nope/stop").json() == {"stopped": False}

    asyncio.run(hold())
    assert client.get("/api/jobs/live").json() == []
