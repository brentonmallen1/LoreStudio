"""What the model proposed for the Codex and the author has not answered (doc 12 P5).

Read by the Codex review endpoint and by the Proposals inbox, which lists these beside
every other thing the app noticed but did not decide.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...models.codex import CodexEdge, CodexNode


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
    nodes = {n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id)}
    out: list[SuggestionOut] = []

    for edge in db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id,
        CodexEdge.source == "llm",
        CodexEdge.kind == "present_in",
        CodexEdge.confirmed_at.is_(None),
    ):
        character, scene = nodes.get(edge.src_id), nodes.get(edge.dst_id)
        if not character or not scene:
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
