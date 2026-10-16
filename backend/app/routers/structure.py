import uuid
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
from ..services.adaptation import AdaptError, check_source_scene
from ..services.dangling import detach_scenes
from ..services.dialogue_service import sync_scene_dialogue
from ..services.edit_conflict import refuse_if_changed
from ..services.held_prose import give_scene, template_levels
from ..services.linking_service import apply_entity_links, suggest_entity_links
from ..services.llm.gateway import AICallContext, AICallResult, ai_gateway
from ..services.llm.prompts.summaries import build_scene_summary_prompt, build_structure_section_summary_prompt
from ..services.llm.sse import sse_message, sse_stream
from ..services.script_scene import derive_heading, split_at_headings, split_scene
from ..services.takes import TakeError, refuse_cut
from ..services.text_utils import for_model
from ..services.word_count import count_lines

router = APIRouter()


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


_CLEARABLE = ("pov_character_id", "beat_id", "era_id", "adapted_from_id")


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
    # A link sent as null (or "") is cleared: a scene's POV back to the story's, its beat or era off.
    for key in _CLEARABLE:
        if key in body.model_fields_set and not getattr(body, key):
            data[key] = None
    if data.get("adapted_from_id"):
        try:
            check_source_scene(db, node, data["adapted_from_id"])
        except AdaptError as e:
            raise HTTPException(status_code=e.status_code, detail=str(e)) from e
    # Someone (another tab, an undo, a restore) changed this node since the client loaded it.
    _unchanged_since(node, data.pop("expected_updated_at", None))
    if "metadata_" in data:
        incoming = dict(data["metadata_"])
        # purpose is a column now; hoist it if an older client sends it here. Margin notes
        # are note rows (doc 15), so an old client's inline_notes are dropped.
        if "purpose" in incoming and "purpose" not in data:
            data["purpose"] = incoming.pop("purpose")
        incoming.pop("purpose", None)
        incoming.pop("inline_notes", None)
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
    if "content" in data:
        story = db.get(Story, node.story_id)
        node.line_count = count_lines(story, node.content)
        derive_heading(node, story, db)
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


def _unchanged_since(node: StructureNode, expected: datetime | None) -> None:
    refuse_if_changed(
        expected,
        node.updated_at,
        message="This segment changed since you loaded it.",
        key="node",
        current=lambda: StructureNodeOut.model_validate(node).model_dump(mode="json"),
    )


def _one_take(db: Session, node: StructureNode) -> None:
    """A scene with several takes is not cut (doc 29 D7): which take would be split?"""
    try:
        refuse_cut(db, node)
    except TakeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class SplitBody(BaseModel):
    """The scene's words up to the cut, and from it on: a script's new heading (doc 25, D3), or
    the cursor in prose (doc 29 D6), whose new scene is named `title`."""

    content: str
    new_content: str
    title: str | None = None
    expected_updated_at: datetime | None = None


@router.post("/{node_id}/split", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def split_node(
    node_id: str,
    body: SplitBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Start a new scene at a script scene's second heading, or at the cursor in prose: the scene
    keeps what came before it, the new scene after it takes the rest, and ⌘Z puts them back."""
    node = _verify_node_access(node_id, db, current_user)
    _unchanged_since(node, body.expected_updated_at)
    _one_take(db, node)
    if not body.new_content.strip():
        raise HTTPException(status_code=400, detail="Nothing to start the new scene with.")
    new = split_scene(
        db, node, body.content, body.new_content, actor_id=current_user.id, client_id=client_id, title=body.title
    )
    db.commit()
    db.refresh(new)
    sync_scene_dialogue(node, db)
    sync_scene_dialogue(new, db)
    return new


class SplitHeadingsBody(BaseModel):
    expected_updated_at: datetime | None = None


@router.post("/{node_id}/split-headings", response_model=StructureNodeOut)
def split_at_every_heading(
    node_id: str,
    body: SplitHeadingsBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Start a scene at every heading below a script scene's own, as several scenes pasted at
    once ask (doc 25, P6). One change ⌘Z takes back whole; returns the scene as it now reads."""
    node = _verify_node_access(node_id, db, current_user)
    _unchanged_since(node, body.expected_updated_at)
    _one_take(db, node)
    made = split_at_headings(db, node, actor_id=current_user.id, client_id=client_id)
    if not made:
        raise HTTPException(status_code=400, detail="There is no other heading in this scene.")
    db.commit()
    for scene in (node, *made):
        sync_scene_dialogue(scene, db)
    db.refresh(node)
    return node


class GiveSceneBody(BaseModel):
    expected_updated_at: datetime | None = None


@router.post("/{node_id}/give-scene", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def give_prose_a_scene(
    node_id: str,
    body: GiveSceneBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """A chapter's (or an act's) own prose, which only scenes show, moved into a new first scene
    named for it (through a chapter, for an act). One change ⌘Z takes back whole."""
    node = _verify_node_access(node_id, db, current_user)
    _unchanged_since(node, body.expected_updated_at)
    levels = template_levels(db.get(Story, node.story_id), db)
    if node.level >= len(levels) - 1 or not (node.word_count or 0):
        raise HTTPException(status_code=400, detail="There is no prose here outside a scene.")
    scene = give_scene(db, node, levels, actor_id=current_user.id, client_id=client_id)
    db.commit()
    db.refresh(scene)
    sync_scene_dialogue(scene, db)
    return scene


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
        llm_messages = [{"role": "user", "content": f"Scene: {node.title}\n\n{for_model(node.content)}"}]
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
                pieces.append(f"[{n.title}]\n{for_model(n.content)}")
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
    tree = change_log.capture_node_tree(node, db)
    batch = detach_scenes(
        db, node.story_id, {n["id"] for n in tree["structure_nodes"]}, actor_id=current_user.id, client_id=client_id
    )
    change_log.record(
        db,
        story_id=node.story_id,
        entity_type="structure_node",
        entity_id=node.id,
        action="delete",
        before=tree,
        after=None,
        label=f"Delete {node.level_type} “{node.title}”",
        actor_id=current_user.id,
        client_id=client_id,
        batch_id=batch,
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
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Apply approved entity link proposals to scene content (one undoable change)."""
    node = _verify_node_access(node_id, db, current_user)
    if not body.links:
        return StructureNodeOut.model_validate(node)

    updated_content = apply_entity_links(
        node.content or "",
        [link.model_dump() for link in body.links],
    )
    if updated_content != (node.content or ""):
        label = f"Link names in “{node.title or 'Untitled'}”"
        write = change_log.prose_writer(
            db, label=label, batch_id=str(uuid.uuid4()), actor_id=current_user.id, client_id=client_id
        )
        write(node, updated_content)
    db.commit()
    db.refresh(node)
    return StructureNodeOut.model_validate(node)
