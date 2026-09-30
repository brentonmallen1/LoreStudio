"""
What the author inspects is what gets sent (doc 07 §5, doc 01 §2.1).

The transparency view exists so an author can see what leaves their machine. It is worth
nothing if it shows a different prompt from the one the feature builds — and worse than
nothing, because it reassures. Both of these previews used to do exactly that: the
interview one built its prompt from the character alone, and the panel one left out the
bound on what a character knows and the length the author asked for.
"""

from app.models.character import Character
from app.models.interview import CharacterInterview
from app.models.panel_interview import PanelInterview
from app.models.story import Story
from app.models.structure import StructureNode
from app.services.codex.context import assemble_panel_member

#: A line that only appears when the knowledge scope was assembled into the prompt.
SCOPE_MARKER = "What you have been present for"


def _cast(db, user):
    story = Story(title="Lighthouse", user_id=user.id)
    db.add(story)
    db.flush()
    elena = Character(story_id=story.id, name="Elena", role="protagonist", personality="Stubborn.")
    mara = Character(story_id=story.id, name="Mara", role="ally")
    db.add_all([elena, mara])
    db.add(
        StructureNode(
            story_id=story.id,
            title="Arrival",
            level=0,
            level_type="scene",
            position=0,
            content="<p>Elena climbed the stair.</p>",
        )
    )
    db.commit()
    return story, elena, mara


def test_the_interview_preview_carries_the_bound_on_what_they_know(client, db_session, test_user):
    story, elena, _ = _cast(db_session, test_user)
    interview = CharacterInterview(character_id=elena.id, knowledge_scope="present")
    db_session.add(interview)
    db_session.commit()

    body = client.post(
        "/api/llm/prompt-preview",
        json={"context_type": "interview", "interview_id": interview.id},
    ).json()
    assert SCOPE_MARKER in body["system_prompt"]
    assert "Arrival" in body["system_prompt"]
    assert any(s["source"] == "interview.scope" for s in body["sources"])


def test_the_panel_preview_is_the_prompt_a_member_is_actually_sent(client, db_session, test_user):
    story, elena, mara = _cast(db_session, test_user)
    panel = PanelInterview(story_id=story.id, character_ids=[elena.id, mara.id])
    db_session.add(panel)
    db_session.commit()

    body = client.post("/api/llm/prompt-preview", json={"context_type": "panel", "panel_id": panel.id})
    preview = body.json()["system_prompt"]
    # The same call the panel router makes for its first speaker.
    sent = assemble_panel_member(elena, [mara], db_session).prompt
    assert preview == sent
    assert SCOPE_MARKER in preview
    assert "Mara" in preview


def test_a_mention_shows_in_the_preview_the_way_the_call_sends_it(client, db_session, test_user):
    from app.schemas.mentions import MentionedRef
    from app.services.codex.mentions import SECTION_HEADING

    story, elena, mara = _cast(db_session, test_user)
    panel = PanelInterview(story_id=story.id, character_ids=[elena.id])
    db_session.add(panel)
    db_session.commit()

    refs = [{"kind": "character", "id": mara.id}]
    preview = client.post(
        "/api/llm/prompt-preview", json={"context_type": "panel", "panel_id": panel.id, "mentioned_refs": refs}
    ).json()
    sent = assemble_panel_member(elena, [], db_session, mentioned_refs=[MentionedRef(**r) for r in refs])
    assert preview["system_prompt"] == sent.prompt
    assert SECTION_HEADING in preview["system_prompt"]
    assert any(s["source"] == "mentioned" and s["included"] for s in preview["sources"])

    # A scene chat at story level (no scene) previews too, and carries the mention.
    scene_preview = client.post(
        "/api/llm/prompt-preview",
        json={"context_type": "scene-chat", "story_id": story.id, "node_id": "__story__", "mentioned_refs": refs},
    )
    assert scene_preview.status_code == 200
    assert "### Mara (character)" in scene_preview.json()["system_prompt"]
