import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.character import Character, CharacterRelationship
from ..models.interview import CharacterInterview
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StoryStructureTemplate, StructureNode
from ..models.user import User
from ..schemas.ai_responses import RelationshipSuggestionsResponse, StructuredResult
from ..schemas.character import CharacterCreate, RelationshipOut
from ..schemas.mentions import MentionedRef
from ..schemas.story import (
    StoryCreate,
    StoryCreated,
    StoryGoalCreate,
    StoryGoalUpdate,
    StoryOut,
    StoryOverview,
    StoryUpdate,
)
from ..schemas.structure import ReorderStructurePayload, StructureNodeCreate, StructureNodeMeta, StructureNodeOut
from ..services import change_log
from ..services.codex.mentions import render_mentions, resolve_mentions
from ..services.color_slots import next_slot
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.generation import build_relationship_suggestion_prompt
from ..services.llm.prompts.snowflake import LAYER_SPECS, build_snowflake_guidance_prompt
from ..services.llm.prompts.summaries import build_story_summary_prompt
from ..services.llm.sse import sse_stream
from ..services.series import service as series_service
from ..services.structure_scaffold import scaffold_story
from ..services.text_utils import last_paragraphs
from ..services.word_count import get_word_count_status

router = APIRouter()


@router.get("", response_model=list[StoryOut])
def list_stories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Story).filter(Story.user_id == current_user.id).order_by(Story.updated_at.desc()).all()


@router.get("/progress")
def list_story_progress(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    For the dashboard's story cards: words written, progress toward the target, and the
    scene to continue in. One query over the tree, no prose.
    """
    stories = db.query(Story).filter(Story.user_id == current_user.id).all()
    rows = (
        db.query(
            StructureNode.story_id,
            StructureNode.id,
            StructureNode.title,
            StructureNode.parent_id,
            StructureNode.word_count,
            StructureNode.updated_at,
        )
        .filter(StructureNode.story_id.in_([st.id for st in stories]))
        .all()
    )
    parents = {r.parent_id for r in rows if r.parent_id}
    leaves = [r for r in rows if r.id not in parents]
    out = []
    for story in stories:
        mine = [r for r in leaves if r.story_id == story.id]
        words = sum(r.word_count or 0 for r in mine)
        written = [r for r in mine if (r.word_count or 0) > 0] or mine
        last = max(written, key=lambda r: r.updated_at, default=None)
        target = get_word_count_status(story.intended_length or "", words)
        out.append(
            {
                "story_id": story.id,
                "word_count": words,
                "target_words": target["max"] if target else None,
                "pct": target["pct"] if target else None,
                "last_scene_id": last.id if last else None,
                "last_scene_title": last.title if last else None,
            }
        )
    return out


@router.post("", response_model=StoryCreated, status_code=status.HTTP_201_CREATED)
def create_story(body: StoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = Story(user_id=current_user.id, **body.model_dump(exclude={"scaffold"}))
    db.add(story)
    db.flush()
    start = None
    if body.scaffold:
        start = scaffold_story(story.id, db.get(StoryStructureTemplate, story.structure_template_id), db)
    db.commit()
    db.refresh(story)
    return StoryCreated.model_validate(story).model_copy(update={"start_node_id": start.id if start else None})


@router.get("/{story_id}", response_model=StoryOut)
def get_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.patch("/{story_id}", response_model=StoryOut)
def update_story(
    story_id: str,
    body: StoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    data = body.model_dump(exclude_unset=True)
    change_log.record_update(
        db,
        story,
        data,
        entity_type="story",
        story_id=story.id,
        label="Edit story {fields}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(story, key, value)
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    # Out of its series first, so elements only it had and an emptied series go too.
    series_service.detach_story(db, story_id)
    db.delete(story)
    db.commit()


#: Activity the Overview leaves to the Chronicle: Assistant calls and analysis runs.
SYSTEM_CATEGORIES = ("ai", "health")
SYSTEM_EVENTS = ("analysis_run", "editorial_pass")


@router.get("/{story_id}/overview", response_model=StoryOverview)
def get_story_overview(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()

    # Determine leaf nodes without touching the ORM relationship attribute.
    # Build a set of node IDs that have at least one child, then any node
    # not in that set is a leaf.
    parent_ids: set[str] = {n.parent_id for n in all_nodes if n.parent_id}
    leaf_nodes = [n for n in all_nodes if n.id not in parent_ids]

    # Word count
    total_words = sum(n.word_count for n in all_nodes)
    scenes_by_status: dict[str, int] = {"planned": 0, "draft": 0, "revised": 0, "final": 0}
    for n in leaf_nodes:
        scenes_by_status[n.status] = scenes_by_status.get(n.status, 0) + 1

    goals = story.goals or []

    # Thread counts
    thread_counts: dict[str, int] = {"planned": 0, "open": 0, "resolved": 0, "set_aside": 0}
    for t in threads:
        if t.status in thread_counts:
            thread_counts[t.status] += 1

    # Recent scenes (most recently updated leaf nodes with content)
    recent_leaves = sorted(
        [n for n in leaf_nodes if n.word_count > 0],
        key=lambda n: n.updated_at,
        reverse=True,
    )[:5]

    # What the author did lately (doc 13 P6): not every Assistant call and analysis run,
    # which the Chronicle keeps, only things done to the story.
    recent_logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.story_id == story_id,
            ActivityLog.user_id == current_user.id,
            ActivityLog.category.notin_(SYSTEM_CATEGORIES),
            ActivityLog.event_type.notin_(SYSTEM_EVENTS),
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(8)
        .all()
    )

    # Recent interviews via character join
    char_ids = [c.id for c in characters]
    char_name_map = {c.id: c.name for c in characters}
    recent_interviews_raw = []
    if char_ids:
        recent_interviews_raw = (
            db.query(CharacterInterview)
            .filter(CharacterInterview.character_id.in_(char_ids))
            .order_by(CharacterInterview.updated_at.desc())
            .limit(3)
            .all()
        )

    # Word count distribution — group leaf nodes by their immediate parent.
    # If a leaf has no parent (flat structure), treat the leaf itself as its own group.
    node_map = {n.id: n for n in all_nodes}
    # bucket: parent_id (or leaf.id if root) → {"node": ..., "words": int, "count": int}
    buckets: dict[str, dict] = {}
    for leaf in leaf_nodes:
        if leaf.parent_id and leaf.parent_id in node_map:
            bucket_id = leaf.parent_id
            container = node_map[leaf.parent_id]
        else:
            bucket_id = leaf.id
            container = leaf
        if bucket_id not in buckets:
            buckets[bucket_id] = {"node": container, "words": 0, "count": 0}
        buckets[bucket_id]["words"] += leaf.word_count
        buckets[bucket_id]["count"] += 1

    # Reading order: the positions along the node's path from the top, so Chapter 2 (first
    # in Act 1's second slot) comes after Chapter 1 and before Chapter 3. Sorting on the
    # node's own position interleaved acts: 1, 3, 5, 2, 4, 6.
    def reading_order(node: StructureNode) -> tuple[int, ...]:
        path: list[int] = []
        at: StructureNode | None = node
        while at is not None:
            path.append(at.position)
            at = node_map.get(at.parent_id) if at.parent_id else None
        return tuple(reversed(path))

    sorted_buckets = sorted(buckets.values(), key=lambda b: reading_order(b["node"]))
    distribution = [
        {
            "id": b["node"].id,
            "title": b["node"].title,
            "level_type": b["node"].level_type,
            "word_count": b["words"],
            "scene_count": b["count"],
            "pct": round(b["words"] / total_words * 100, 1) if total_words else 0.0,
        }
        for b in sorted_buckets
    ]

    return StoryOverview(
        word_count=total_words,
        word_count_target=get_word_count_status(story.intended_length or "", total_words),
        resume_excerpt=last_paragraphs(recent_leaves[0].content or "") if recent_leaves else [],
        scene_count=len(leaf_nodes),
        scenes_by_status=scenes_by_status,
        character_count=len(characters),
        thread_counts=thread_counts,
        recent_scenes=[
            {
                "id": n.id,
                "title": n.title,
                "word_count": n.word_count,
                "status": n.status,
                "level_type": n.level_type,
                "updated_at": n.updated_at,
            }
            for n in recent_leaves
        ],
        recent_activity=[
            {
                "event_type": log.event_type,
                "description": log.description,
                "created_at": log.created_at,
                "category": log.category,
            }
            for log in recent_logs
        ],
        recent_interviews=[
            {
                "id": iv.id,
                "character_id": iv.character_id,
                "character_name": char_name_map.get(iv.character_id, "Unknown"),
                "title": iv.title or "Untitled Interview",
                "updated_at": iv.updated_at,
            }
            for iv in recent_interviews_raw
        ],
        distribution=distribution,
        goals_done=sum(1 for g in goals if g.get("completed")),
        goals_total=len(goals),
        next_goal=next((g.get("text", "") for g in goals if not g.get("completed")), ""),
        open_threads=[t.name for t in sorted(threads, key=lambda t: t.created_at) if t.status in ("planned", "open")],
    )


@router.post("/{story_id}/summarize")
async def summarize_story(
    story_id: str,
    up_to_node_id: str | None = Body(None, embed=True),
    style: str = Body("brief", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Gather all scene nodes with content
    all_nodes = (
        db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position).all()
    )
    nodes_content = [{"title": n.title, "content": n.content} for n in all_nodes if n.content and n.content.strip()]

    up_to_title = None
    if up_to_node_id:
        target = db.get(StructureNode, up_to_node_id)
        if target:
            up_to_title = target.title
            # Only include nodes up to this one
            target_idx = next((i for i, n in enumerate(all_nodes) if n.id == up_to_node_id), len(all_nodes))
            nodes_content = [
                {"title": n.title, "content": n.content}
                for n in all_nodes[: target_idx + 1]
                if n.content and n.content.strip()
            ]

    feature_prompt = build_story_summary_prompt(
        title=story.title,
        intent=story.narrative_intent or story.intent,
        nodes_content=nodes_content,
        up_to_title=up_to_title,
        style=style,
    )
    llm_messages = [{"role": "user", "content": "Please provide the summary."}]

    ctx = AICallContext(
        feature="story-summary",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story", "summarization", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/{story_id}/snowflake/guidance")
async def snowflake_guidance(
    story_id: str,
    layer: str = Body(..., embed=True),
    content: str = Body("", embed=True),
    character_id: str | None = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return AI guidance (questions and observations) for the given Snowflake layer.

    The AI never writes content — it analyzes what the author has written
    and asks questions to prompt deeper thinking.
    """
    if layer not in LAYER_SPECS:
        raise HTTPException(status_code=400, detail=f"Unknown layer: {layer}")

    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Build a brief story context for the AI
    context_parts = []
    if story.title:
        context_parts.append(f"Title: {story.title}")
    if story.logline:
        context_parts.append(f"One-sentence summary: {story.logline}")
    if story.paragraph_summary:
        context_parts.append(f"One-paragraph summary: {story.paragraph_summary}")

    if character_id and layer in ("character_summary", "character_synopsis"):
        char = db.get(Character, character_id)
        if char and char.story_id == story_id:
            if char.name:
                context_parts.append(f"Character: {char.name} ({char.role})")
            if layer == "character_synopsis":
                for label, value in (
                    ("Goal", char.mission_statement),
                    ("Motivation", char.motivation),
                    ("Conflict", char.conflict),
                    ("Epiphany", char.epiphany),
                ):
                    if value:
                        context_parts.append(f"{label}: {value}")

    story_context = "\n".join(context_parts)
    feature_prompt = build_snowflake_guidance_prompt(layer=layer, content=content, story_context=story_context)
    llm_messages = [{"role": "user", "content": "Please review my work and give me guidance."}]

    ctx = AICallContext(
        feature="snowflake-guidance",
        user_id=current_user.id,
        story_id=story_id,
        tags=["snowflake", "guidance", "user-initiated"],
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


class SuggestRelationshipsRequest(BaseModel):
    character_id: str | None = None  # focus character (optional)


@router.post("/{story_id}/suggest-relationships", response_model=StructuredResult)
async def suggest_relationships(
    story_id: str,
    body: SuggestRelationshipsRequest = Body(default_factory=SuggestRelationshipsRequest),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    if len(characters) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 characters to suggest relationships")

    existing_rels = (
        db.query(CharacterRelationship).filter(CharacterRelationship.character_id.in_([c.id for c in characters])).all()
    )

    char_by_id = {c.id: c for c in characters}
    char_by_name = {c.name.lower(): c for c in characters}
    char_names = {c.id: c.name for c in characters}
    existing = [
        {
            "from": char_names.get(r.character_id, "?"),
            "to": char_names.get(r.related_character_id, "?"),
            "type": r.relationship_type,
        }
        for r in existing_rels
    ]

    focus_char = char_by_id.get(body.character_id) if body.character_id else None
    feature_prompt = build_relationship_suggestion_prompt(characters, existing, focus_char)
    llm_messages = [{"role": "user", "content": "Please suggest relationships."}]

    ctx = AICallContext(
        feature="relationship-suggest",
        user_id=current_user.id,
        story_id=story_id,
        tags=["character", "generation", "lorebook", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=RelationshipSuggestionsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    def resolve_name(name: str) -> str:
        key = name.strip().lower()
        if key in char_by_name:
            return char_by_name[key].id
        # Prefix fallback for slightly mismatched names
        for c in characters:
            if c.name.lower().startswith(key[:5]) or key.startswith(c.name.lower()[:5]):
                return c.id
        return ""

    # Resolve character names → IDs in-place so the frontend can use them directly
    if result.success and isinstance(result.data, dict):
        for s in result.data.get("suggestions", []):
            s["character_a_id"] = resolve_name(s.get("character_a") or "")
            s["character_b_id"] = resolve_name(s.get("character_b") or "")

    return result


@router.get("/{story_id}/structure", response_model=list[StructureNodeMeta])
def get_story_structure(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    # Single flat query — avoids N+1 from recursive lazy-loaded children
    all_nodes = (
        db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position).all()
    )
    # Python attribute names for all column properties (handles metadata_ → "metadata" DB column)
    col_attrs = [prop.key for prop in sa_inspect(StructureNode).mapper.column_attrs]
    # Build flat dict map, then assemble into tree
    node_dicts: dict[str, dict] = {}
    for node in all_nodes:
        d = {attr: getattr(node, attr) for attr in col_attrs}
        d["children"] = []
        node_dicts[d["id"]] = d
    roots = []
    for d in node_dicts.values():
        pid = d["parent_id"]
        if pid is None:
            roots.append(d)
        elif pid in node_dicts:
            node_dicts[pid]["children"].append(d)

    def _sort(nodes: list) -> list:
        nodes.sort(key=lambda n: n["position"])
        for n in nodes:
            _sort(n["children"])
        return nodes

    return _sort(roots)


@router.post("/{story_id}/structure", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def create_structure_node(
    story_id: str,
    body: StructureNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    node = StructureNode(story_id=story_id, **body.model_dump())
    db.add(node)
    db.flush()
    change_log.record(
        db,
        story_id=story_id,
        entity_type="structure_node",
        entity_id=node.id,
        action="create",
        before=None,
        after=change_log.capture_node_tree(node, db),
        label=f"Add {node.level_type} “{node.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(node)
    return node


@router.post("/{story_id}/structure/start")
def start_structure(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """
    Lay out an empty story's first outline from its template, and say where to write.

    The Write page's empty state calls this, so a story that has nothing yet is one click
    from a scene. One undo removes the whole outline.
    """
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if db.query(StructureNode.id).filter(StructureNode.story_id == story_id).first():
        raise HTTPException(status_code=409, detail="This story already has an outline")
    start = scaffold_story(story_id, db.get(StoryStructureTemplate, story.structure_template_id), db)
    if start is None:  # a template with no levels: one scene is still somewhere to write
        start = StructureNode(story_id=story_id, level=0, level_type="scene", title="Scene 1", position=0)
        db.add(start)
        db.flush()
    batch = str(uuid.uuid4())
    for top in db.query(StructureNode).filter(StructureNode.story_id == story_id, StructureNode.parent_id.is_(None)):
        change_log.record(
            db,
            story_id=story_id,
            entity_type="structure_node",
            entity_id=top.id,
            action="create",
            before=None,
            after=change_log.capture_node_tree(top, db),
            label="Start the outline",
            actor_id=current_user.id,
            client_id=client_id,
            batch_id=batch,
        )
    db.commit()
    return {"start_node_id": start.id}


@router.post("/{story_id}/structure/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_structure(
    story_id: str,
    body: ReorderStructurePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Batch reorder structure nodes. Supports reordering within a parent and reparenting."""
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    ids = [op.node_id for op in body.operations]
    before = change_log.reorder_snapshot(StructureNode, ids, db)
    for op in body.operations:
        node = db.get(StructureNode, op.node_id)
        if node and node.story_id == story_id:
            if node.parent_id != op.parent_id:
                node.parent_id = op.parent_id
                if op.parent_id:
                    parent = db.get(StructureNode, op.parent_id)
                    node.level = (parent.level + 1) if parent else 0
                else:
                    node.level = 0
            node.position = op.position
    db.flush()
    after = change_log.reorder_snapshot(StructureNode, ids, db)
    if before != after:
        change_log.record(
            db,
            story_id=story_id,
            entity_type="structure_node",
            entity_id=story_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder sections",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()


@router.get("/{story_id}/characters")
def list_characters(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.character import Character
    from ..schemas.character import CharacterOut

    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    characters = db.query(Character).filter(Character.story_id == story_id).order_by(Character.name).all()
    return [CharacterOut.model_validate(c) for c in characters]


@router.get("/{story_id}/relationships", response_model=list[RelationshipOut])
def list_story_relationships(
    story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    from sqlalchemy import select

    char_subq = select(Character.id).where(Character.story_id == story_id)
    return db.query(CharacterRelationship).filter(CharacterRelationship.character_id.in_(char_subq)).all()


@router.post("/{story_id}/characters", status_code=status.HTTP_201_CREATED)
def create_character(
    story_id: str,
    body: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    from ..models.character import Character
    from ..schemas.character import CharacterOut

    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    character = Character(story_id=story_id, **body.model_dump())
    if not character.color_slot:
        character.color_slot = next_slot(
            slot for (slot,) in db.query(Character.color_slot).filter(Character.story_id == story_id).all()
        )
    db.add(character)
    db.flush()
    change_log.record_row_create(
        db,
        character,
        "characters",
        entity_type="character",
        story_id=story_id,
        label=f"Add character {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(character)
    return CharacterOut.model_validate(character)


def _story_for(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _save_goals(db: Session, story: Story, goals: list[dict], label: str, user: User, client_id: str | None) -> Story:
    """Write the goals list as one undoable change. ``goals`` must be fresh dicts: editing the
    loaded JSON in place would leave the column, and the diff, unchanged."""
    change_log.record_update(
        db,
        story,
        {"goals": goals},
        entity_type="story",
        story_id=story.id,
        label=label,
        actor_id=user.id,
        client_id=client_id,
    )
    story.goals = goals
    db.commit()
    db.refresh(story)
    return story


@router.post("/{story_id}/goals", response_model=StoryOut)
def add_goal(
    story_id: str,
    body: StoryGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = _story_for(story_id, db, current_user)
    goals = [dict(g) for g in (story.goals or [])]
    goals.append({"id": str(uuid.uuid4()), "text": body.text, "completed": False})
    return _save_goals(db, story, goals, f"Add goal “{body.text}”", current_user, client_id)


@router.patch("/{story_id}/goals/reorder", response_model=StoryOut)
def reorder_goals(
    story_id: str,
    body: list[str] = Body(..., description="Ordered list of goal IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = _story_for(story_id, db, current_user)
    goals_by_id = {g["id"]: dict(g) for g in (story.goals or [])}
    goals = [goals_by_id[gid] for gid in body if gid in goals_by_id]
    return _save_goals(db, story, goals, "Reorder goals", current_user, client_id)


@router.patch("/{story_id}/goals/{goal_id}", response_model=StoryOut)
def update_goal(
    story_id: str,
    goal_id: str,
    body: StoryGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = _story_for(story_id, db, current_user)
    goals = [dict(g) for g in (story.goals or [])]
    label = "Edit goal"
    for goal in goals:
        if goal["id"] == goal_id:
            if body.text is not None:
                goal["text"] = body.text
            if body.completed is not None:
                goal["completed"] = body.completed
            verb = "Edit" if body.completed is None else ("Complete" if body.completed else "Reopen")
            label = f"{verb} goal “{goal['text']}”"
    return _save_goals(db, story, goals, label, current_user, client_id)


@router.delete("/{story_id}/goals/{goal_id}", response_model=StoryOut)
def delete_goal(
    story_id: str,
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    story = _story_for(story_id, db, current_user)
    gone = next((g for g in (story.goals or []) if g["id"] == goal_id), None)
    goals = [dict(g) for g in (story.goals or []) if g["id"] != goal_id]
    label = f"Delete goal “{gone['text']}”" if gone else "Delete goal"
    return _save_goals(db, story, goals, label, current_user, client_id)


class IdentityWorkshopRequest(BaseModel):
    messages: list[dict]
    llm_params: dict | None = None
    #: What the author @mentioned in the composer (doc 11 P6).
    mentioned_refs: list[MentionedRef] = []


@router.post("/{story_id}/identity-workshop")
async def identity_workshop(
    story_id: str,
    body: IdentityWorkshopRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..schemas.llm_params import LLMParamsOverride
    from ..services.llm.prompts.workshop import build_identity_workshop_prompt

    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    prompt = build_identity_workshop_prompt(story, db) + render_mentions(
        resolve_mentions(story.id, body.mentioned_refs, db)
    )
    llm_params = LLMParamsOverride(**body.llm_params) if body.llm_params else None

    ctx = AICallContext(
        feature="identity-workshop",
        user_id=current_user.id,
        story_id=story_id,
        tags=["story-identity", "workshop", "guide"],
    )

    return sse_stream(
        ai_gateway,
        messages=body.messages,
        feature_prompt=prompt,
        context=ctx,
        db=db,
        user=current_user,
        llm_params=llm_params,
    )


@router.get("/{story_id}/settings")
def list_settings(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.setting import Setting
    from ..schemas.setting import SettingOut

    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    settings = db.query(Setting).filter(Setting.story_id == story_id).order_by(Setting.name).all()
    return [SettingOut.model_validate(s) for s in settings]
