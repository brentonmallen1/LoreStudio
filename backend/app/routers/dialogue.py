"""
Dialogue API endpoints.

GET  /api/scenes/{scene_id}/dialogue        — list dialogue blocks for a scene
POST /api/scenes/{scene_id}/dialogue/refresh — re-extract from current content
GET  /api/stories/{story_id}/dialogue/stats  — aggregate stats for health dashboard
GET  /api/stories/{story_id}/dialogue/interactions — character interaction matrix
PATCH /api/dialogue/{block_id}              — manually correct a block's attribution
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.dialogue import DialogueBlock
from ..services.dialogue_service import sync_dialogue_blocks, get_dialogue_stats, get_interaction_matrix
from ..auth.dependencies import get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DialogueBlockOut(BaseModel):
    id: str
    scene_id: str
    character_id: str | None
    speaker_name: str
    content: str
    raw_text: str
    paragraph_index: int
    position_in_paragraph: int
    attribution_method: str
    confidence: float
    subtext: str | None

    model_config = {"from_attributes": True}


class DialogueBlockPatch(BaseModel):
    speaker_name: str | None = None
    character_id: str | None = None
    subtext: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_scene(scene_id: str, db: Session, user: User) -> StructureNode:
    node = db.get(StructureNode, scene_id)
    if not node:
        raise HTTPException(status_code=404, detail="Scene not found")
    story = db.query(Story).filter(Story.id == node.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Scene not found")
    return node


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


# ---------------------------------------------------------------------------
# Scene-level endpoints
# ---------------------------------------------------------------------------

@router.get("/scenes/{scene_id}/dialogue", response_model=list[DialogueBlockOut])
def list_dialogue(
    scene_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all dialogue blocks for a scene, ordered by position."""
    _get_scene(scene_id, db, current_user)
    return (
        db.query(DialogueBlock)
        .filter(DialogueBlock.scene_id == scene_id)
        .order_by(DialogueBlock.paragraph_index, DialogueBlock.position_in_paragraph)
        .all()
    )


@router.post("/scenes/{scene_id}/dialogue/refresh", response_model=list[DialogueBlockOut])
def refresh_dialogue(
    scene_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-extract dialogue blocks from the scene's current content."""
    node = _get_scene(scene_id, db, current_user)
    if not node.content:
        return []
    return sync_dialogue_blocks(scene_id, node.content, node.story_id, db)


@router.patch("/dialogue/{block_id}", response_model=DialogueBlockOut)
def patch_dialogue_block(
    block_id: str,
    body: DialogueBlockPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually correct a dialogue block's speaker attribution or subtext."""
    block = db.get(DialogueBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Dialogue block not found")

    # Verify ownership
    node = db.get(StructureNode, block.scene_id)
    story = db.query(Story).filter(Story.id == node.story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Dialogue block not found")

    data = body.model_dump(exclude_none=True)
    if data:
        # Any manual edit marks this block as manually attributed with full confidence
        if "speaker_name" in data or "character_id" in data:
            block.attribution_method = "manual"
            block.confidence = 1.0
        for key, value in data.items():
            setattr(block, key, value)
        db.commit()
        db.refresh(block)

    return block


# ---------------------------------------------------------------------------
# Story-level analytics endpoints
# ---------------------------------------------------------------------------

@router.get("/stories/{story_id}/dialogue/stats")
def dialogue_stats(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate dialogue statistics for the Story Health dashboard."""
    _get_story(story_id, db, current_user)
    return get_dialogue_stats(story_id, db)


@router.get("/stories/{story_id}/dialogue/interactions")
def dialogue_interactions(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pairwise character interaction data based on shared dialogue scenes."""
    _get_story(story_id, db, current_user)
    return get_interaction_matrix(story_id, db)
