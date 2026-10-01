"""What the model proposed for the Codex and the author has not answered (doc 12 P5).

Read by the Codex review endpoint and by the Proposals inbox, which lists these beside
every other thing the app noticed but did not decide.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...models.codex import CodexEdge, CodexNode
from ...models.location import ScenePresence
from ...models.reader_knowledge import ReaderKnowledgeEvent


class SuggestionOut(BaseModel):
    id: str
    #: "presence" | "fact" — what confirming this would write into the Lorebook.
    kind: str
    #: What the proposal says, in one line.
    statement: str
    #: The words in the scene it was read from. The author checks a quote, not a claim.
    quote: str
    confidence: float
    scene_id: str | None = None
    scene_title: str = ""


def pending_suggestions(story_id: str, db: Session) -> list[SuggestionOut]:
    """A proposal is pending until the author has written the row it proposes (doc 13 P4):
    a presence answer for that scene and character, or a reader-knowledge event. Undoing
    the answer brings the proposal back; a "no" is a decline, kept with the others."""
    nodes = {n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id)}
    out: list[SuggestionOut] = []
    answered = {
        (p.node_id, p.character_id)
        for p in db.query(ScenePresence)
        .join(CodexNode, CodexNode.ref_id == ScenePresence.node_id)
        .filter(CodexNode.story_id == story_id)
    }
    known = {
        (e.node_id, e.subject) for e in db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id)
    }

    for edge in db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id,
        CodexEdge.source == "llm",
        CodexEdge.kind == "present_in",
        CodexEdge.confirmed_at.is_(None),
    ):
        character, scene = nodes.get(edge.src_id), nodes.get(edge.dst_id)
        if not character or not scene or (scene.ref_id, character.ref_id) in answered:
            continue
        out.append(
            SuggestionOut(
                id=edge.id,
                kind="presence",
                statement=f"{character.label} is present in this scene",
                quote=(edge.props or {}).get("quote", ""),
                confidence=edge.confidence,
                scene_id=scene.ref_id,
                scene_title=scene.label,
            )
        )

    established = {
        e.src_id: e
        for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.kind == "established_in")
    }
    for fact in db.query(CodexNode).filter(
        CodexNode.story_id == story_id, CodexNode.kind == "fact", CodexNode.source == "llm"
    ):
        scene = nodes.get(established[fact.id].dst_id) if fact.id in established else None
        if (scene.ref_id if scene else None, fact.label) in known:
            continue
        out.append(
            SuggestionOut(
                id=fact.id,
                kind="fact",
                statement=fact.label,
                quote=(fact.props or {}).get("quote", ""),
                confidence=float((fact.props or {}).get("confidence", 0.5)),
                scene_id=scene.ref_id if scene else None,
                scene_title=scene.label if scene else "",
            )
        )
    out.sort(key=lambda s: (s.scene_title, -s.confidence))
    return out
