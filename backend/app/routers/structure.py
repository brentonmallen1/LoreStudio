from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.structure import StructureNodeOut, StructureNodeUpdate
from ..services import change_log
from ..services.dialogue_service import sync_scene_dialogue
from ..services.linking_service import apply_entity_links, suggest_entity_links
from ..services.llm.gateway import AICallContext, AICallResult, ai_gateway
from ..services.llm.prompts.summaries import build_scene_summary_prompt, build_structure_section_summary_prompt
from ..services.llm.sse import sse_message, sse_stream

router = APIRouter()


def _differs(expected: datetime, actual: datetime) -> bool:
    """
    Compare ignoring timezone awareness. The client sends back the exact string it was
    given, so the only slack needed is a millisecond, for a value that went through a
    JavaScript Date. It used to be a whole second, which let a second tab's save — or a
    bulk rewrite — land unopposed if it came within a second of the load.
    """
    e = expected.replace(tzinfo=None)
    a = actual.replace(tzinfo=None)
    return abs((e - a).total_seconds()) > 0.001


def _update_label(node: StructureNode, after: dict) -> str:
    if "title" in after:
        return f"Rename “{node.title}” to “{after['title']}”"
    if "status" in after:
        return f"Mark “{node.title}” {after['status']}"
    if set(after) <= {"content", "word_count"}:
        return f"Edit “{node.title}”"
    fields = ", ".join(sorted(k for k in after if k != "word_count"))
    return f"Edit {fields} on “{node.title}”"


def _verify_node_access(node_id: str, db: Session, user: User) -> StructureNode:
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    story = db.query(Story).filter(Story.id == node.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/{node_id}", response_model=StructureNodeOut)
def get_node(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_node_access(node_id, db, current_user)


@router.patch("/{node_id}", response_model=StructureNodeOut)
def update_node(
    node_id: str,
    body: StructureNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    node = _verify_node_access(node_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    expected = data.pop("expected_updated_at", None)
    if expected is not None and node.updated_at is not None and _differs(expected, node.updated_at):
        # Someone (another tab, an undo, a restore) changed this node since the client loaded it.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "This segment changed since you loaded it.",
                "node": StructureNodeOut.model_validate(node).model_dump(mode="json"),
            },
        )
    if "metadata_" in data:
        incoming = dict(data["metadata_"])
        # purpose and inline_notes are columns now; hoist them if an older client sends them here.
        for key in ("purpose", "inline_notes"):
            if key in incoming and key not in data:
                data[key] = incoming.pop(key)
            else:
                incoming.pop(key, None)
        # Merge, never replace: different UI surfaces write different keys of the same JSON column.
        merged = {k: v for k, v in (node.metadata_ or {}).items() if k not in ("purpose", "inline_notes")}
        data["metadata_"] = {**merged, **incoming}
    # If content is being updated, mark summary as stale (unless author is explicitly setting summary_stale)
    if "content" in data and "summary_stale" not in data:
        node.summary_stale = True
    # If author manually edits content_summary, treat it as fresh
    if "content_summary" in data and "summary_stale" not in data:
        data["summary_stale"] = False
    before, after = change_log.diff_fields(node, data)
    if before:
        # Prose edits are logged for the Activity page but not undoable here: the editor's own
        # history handles keystrokes. Everything else (title, status, purpose, notes...) is.
        prose_only = set(after) <= {"content", "word_count"}
        change_log.record(
            db,
            story_id=node.story_id,
            entity_type="structure_node",
            entity_id=node.id,
            action="content" if prose_only else "update",
            before=before,
            after=after,
            label=_update_label(node, after),
            actor_id=current_user.id,
            client_id=client_id,
            undoable=not prose_only,
        )
    for key, value in data.items():
        setattr(node, key, value)
    if node.status == "planned" and "status" not in data and (data.get("word_count") or 0) > 0:
        # The first words turn a planned scene into a draft. Logged, not undoable on its own:
        # undoing it would leave prose in a scene marked as not yet written.
        change_log.record(
            db,
            story_id=node.story_id,
            entity_type="structure_node",
            entity_id=node.id,
            action="update",
            before={"status": "planned"},
            after={"status": "draft"},
            label=f"“{node.title}” became a draft",
            actor_id=current_user.id,
            client_id=client_id,
            undoable=False,
        )
        node.status = "draft"
    db.commit()
    db.refresh(node)

    # Re-extract dialogue whenever content changes (an emptied scene has none left)
    if "content" in data:
        sync_scene_dialogue(node, db)

    return node


@router.post("/{node_id}/summarize")
async def summarize_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream an AI-generated summary of a scene or section, then persist it."""

    node = _verify_node_access(node_id, db, current_user)
    story = db.query(Story).filter(Story.id == node.story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Leaf node: has direct prose content
    if node.content and node.content.strip():
        feature_prompt = build_scene_summary_prompt(node.title, node.content)
        llm_messages = [{"role": "user", "content": f"Scene: {node.title}\n\n{node.content}"}]
        feature = "scene-summary"
    else:
        # Section node: gather all child content recursively
        all_nodes = db.query(StructureNode).filter(StructureNode.story_id == node.story_id).all()
        child_map: dict[str | None, list[StructureNode]] = {}
        for n in all_nodes:
            child_map.setdefault(n.parent_id, []).append(n)

        def gather_content(n: StructureNode) -> list[str]:
            pieces = []
            if n.content and n.content.strip():
                pieces.append(f"[{n.title}]\n{n.content}")
            for child in sorted(child_map.get(n.id, []), key=lambda c: c.position):
                pieces.extend(gather_content(child))
            return pieces

        content_pieces = gather_content(node)
        if not content_pieces:
            return sse_message("No content to summarize in this section.")

        feature_prompt = build_structure_section_summary_prompt(
            story_title=story.title,
            story_intent=getattr(story, "narrative_intent", None) or getattr(story, "intent", None),
            node_title=node.title,
            content_text="\n\n".join(content_pieces),
        )
        llm_messages = [{"role": "user", "content": "Summarize this section."}]
        feature = "structure-summary"

    ctx = AICallContext(
        feature=feature,
        user_id=current_user.id,
        story_id=node.story_id,
        node_id=node_id,
        tags=["manuscript", "summarization", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        node.content_summary = result.content
        node.summary_stale = False
        node.summary_updated_at = datetime.now(UTC)
        db.commit()
        _invalidate_journey_summaries(node_id, db)

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
        on_complete=on_complete,
    )


def _invalidate_journey_summaries(node_id: str, db: Session) -> None:
    """Mark journey summaries that included this node as stale."""
    try:
        from ..models.character_journey import CharacterJourneySummary

        affected = (
            db.query(CharacterJourneySummary).filter(CharacterJourneySummary.source_node_ids.contains(node_id)).all()
        )
        for j in affected:
            j.is_stale = True
        if affected:
            db.commit()
    except Exception:
        pass  # Model may not exist yet if migration hasn't run


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    node = _verify_node_access(node_id, db, current_user)
    change_log.record(
        db,
        story_id=node.story_id,
        entity_type="structure_node",
        entity_id=node.id,
        action="delete",
        before=change_log.capture_node_tree(node, db),
        after=None,
        label=f"Delete {node.level_type} “{node.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(node)
    db.commit()


# ---------------------------------------------------------------------------
# Entity linking endpoints
# ---------------------------------------------------------------------------


class ProposedEntityLink(BaseModel):
    id: str
    entity_type: str  # "character" | "location"
    entity_id: str
    entity_name: str
    matched_text: str
    text_start: int
    confidence: float
    source_excerpt: str


class ApplyLinkRequest(BaseModel):
    matched_text: str
    entity_name: str
    entity_type: str  # "character" | "location"


class ApplyLinksBody(BaseModel):
    links: list[ApplyLinkRequest]


@router.post("/{node_id}/suggest-links", response_model=list[ProposedEntityLink])
def suggest_links(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan scene for unlinked character and location mentions and propose @/[[]] links."""
    node = _verify_node_access(node_id, db, current_user)
    if not node.content:
        return []
    return suggest_entity_links(node.content, node.story_id, db)


@router.post("/{node_id}/apply-links", response_model=StructureNodeOut)
def apply_links(
    node_id: str,
    body: ApplyLinksBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply approved entity link proposals to scene content."""
    node = _verify_node_access(node_id, db, current_user)
    if not body.links:
        return StructureNodeOut.model_validate(node)

    updated_content = apply_entity_links(
        node.content or "",
        [link.model_dump() for link in body.links],
    )
    node.content = updated_content
    db.commit()
    db.refresh(node)
    return StructureNodeOut.model_validate(node)
