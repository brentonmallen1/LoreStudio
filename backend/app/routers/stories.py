import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.character import Character, CharacterRelationship
from ..schemas.story import StoryCreate, StoryUpdate, StoryOut, StoryGoalCreate, StoryGoalUpdate, StoryOverview
from ..models.plot_thread import PlotThread
from ..models.activity_log import ActivityLog
from ..models.interview import CharacterInterview
from ..services.word_count import get_word_count_status
from ..schemas.character import RelationshipOut
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.summaries import build_story_summary_prompt
from ..services.llm.prompts.generation import build_relationship_suggestion_prompt
from ..schemas.ai_responses import RelationshipSuggestionsResponse, StructuredResult
from ..schemas.structure import StructureNodeCreate, StructureNodeOut
from ..auth.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=list[StoryOut])
def list_stories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Story).filter(Story.user_id == current_user.id).order_by(Story.updated_at.desc()).all()


@router.post("", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
def create_story(body: StoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = Story(user_id=current_user.id, **body.model_dump())
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


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
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(story, key, value)
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(story)
    db.commit()


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
    scenes_by_status: dict[str, int] = {"draft": 0, "revised": 0, "final": 0}
    for n in leaf_nodes:
        scenes_by_status[n.status] = scenes_by_status.get(n.status, 0) + 1

    # Thread counts
    thread_counts: dict[str, int] = {"open": 0, "developing": 0, "resolved": 0}
    for t in threads:
        if t.status in thread_counts:
            thread_counts[t.status] += 1

    # Recent scenes (most recently updated leaf nodes with content)
    recent_leaves = sorted(
        [n for n in leaf_nodes if n.word_count > 0],
        key=lambda n: n.updated_at,
        reverse=True,
    )[:5]

    # Recent activity logs
    recent_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.story_id == story_id, ActivityLog.user_id == current_user.id)
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

    # Sort by position order: prefer parent's position, fallback to node id
    sorted_buckets = sorted(buckets.values(), key=lambda b: b["node"].position)
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
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position).all()
    nodes_content = [{"title": n.title, "content": n.content} for n in all_nodes if n.content and n.content.strip()]

    up_to_title = None
    if up_to_node_id:
        target = db.get(StructureNode, up_to_node_id)
        if target:
            up_to_title = target.title
            # Only include nodes up to this one
            target_idx = next((i for i, n in enumerate(all_nodes) if n.id == up_to_node_id), len(all_nodes))
            nodes_content = [{"title": n.title, "content": n.content} for n in all_nodes[:target_idx + 1] if n.content and n.content.strip()]

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

    async def stream():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
        ):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


@router.post("/{story_id}/suggest-relationships", response_model=StructuredResult)
async def suggest_relationships(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.character import Character, CharacterRelationship
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    if len(characters) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 characters to suggest relationships")

    existing_rels = db.query(CharacterRelationship).filter(
        CharacterRelationship.character_id.in_([c.id for c in characters])
    ).all()

    char_names = {c.id: c.name for c in characters}
    existing = [
        {"from": char_names.get(r.character_id, "?"), "to": char_names.get(r.related_character_id, "?"), "type": r.relationship_type}
        for r in existing_rels
    ]

    feature_prompt = build_relationship_suggestion_prompt(characters, existing)
    llm_messages = [{"role": "user", "content": "Please suggest relationships."}]

    ctx = AICallContext(
        feature="relationship-suggest",
        user_id=current_user.id,
        story_id=story_id,
        tags=["character", "generation", "lorebook", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=RelationshipSuggestionsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.get("/{story_id}/structure", response_model=list[StructureNodeOut])
def get_story_structure(
    story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    roots = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == story_id, StructureNode.parent_id == None)
        .order_by(StructureNode.position)
        .all()
    )
    return roots


@router.post("/{story_id}/structure", response_model=StructureNodeOut, status_code=status.HTTP_201_CREATED)
def create_structure_node(
    story_id: str,
    body: StructureNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    node = StructureNode(story_id=story_id, **body.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


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
    char_ids = [c.id for c in db.query(Character).filter(Character.story_id == story_id).all()]
    if not char_ids:
        return []
    return db.query(CharacterRelationship).filter(CharacterRelationship.character_id.in_(char_ids)).all()


@router.post("/{story_id}/characters", status_code=status.HTTP_201_CREATED)
def create_character(
    story_id: str,
    body,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.character import Character
    from ..schemas.character import CharacterCreate, CharacterOut
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    character = Character(story_id=story_id, **body.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return CharacterOut.model_validate(character)


@router.post("/{story_id}/goals", response_model=StoryOut)
def add_goal(
    story_id: str,
    body: StoryGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    goals = list(story.goals or [])
    goals.append({"id": str(uuid.uuid4()), "text": body.text, "completed": False})
    story.goals = goals
    db.commit()
    db.refresh(story)
    return story


@router.patch("/{story_id}/goals/{goal_id}", response_model=StoryOut)
def update_goal(
    story_id: str,
    goal_id: str,
    body: StoryGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    goals = list(story.goals or [])
    for goal in goals:
        if goal["id"] == goal_id:
            if body.text is not None:
                goal["text"] = body.text
            if body.completed is not None:
                goal["completed"] = body.completed
    story.goals = goals
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}/goals/{goal_id}", response_model=StoryOut)
def delete_goal(
    story_id: str,
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    story.goals = [g for g in (story.goals or []) if g["id"] != goal_id]
    db.commit()
    db.refresh(story)
    return story


@router.get("/{story_id}/settings")
def list_settings(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ..models.setting import Setting
    from ..schemas.setting import SettingOut
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    settings = db.query(Setting).filter(Setting.story_id == story_id).order_by(Setting.name).all()
    return [SettingOut.model_validate(s) for s in settings]
