import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.story import StoryCreate, StoryUpdate, StoryOut, StoryGoalCreate, StoryGoalUpdate
from ..services.llm.ollama import ollama_provider
from ..services.llm.prompts import build_story_summary_prompt, build_relationship_suggestion_prompt
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
    for key, value in body.model_dump(exclude_none=True).items():
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

    system_prompt = build_story_summary_prompt(
        title=story.title,
        intent=story.narrative_intent or story.intent,
        nodes_content=nodes_content,
        up_to_title=up_to_title,
        style=style,
    )
    llm_messages = [{"role": "user", "content": "Please provide the summary."}]

    async def stream():
        async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


@router.post("/{story_id}/suggest-relationships")
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

    system_prompt = build_relationship_suggestion_prompt(characters, existing)
    llm_messages = [{"role": "user", "content": "Please suggest relationships."}]

    async def stream():
        async for token in ollama_provider.chat_stream(llm_messages, system_prompt):
            yield token

    return StreamingResponse(stream(), media_type="text/plain")


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
