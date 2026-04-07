"""
Dialogue API endpoints.

GET  /api/scenes/{scene_id}/dialogue              — list dialogue blocks for a scene
POST /api/scenes/{scene_id}/dialogue/refresh       — re-extract from current content
POST /api/scenes/{scene_id}/dialogue/suggest-tags  — propose <Name> suffixes for untagged quotes
POST /api/scenes/{scene_id}/dialogue/apply-tags    — apply approved tag proposals to scene content
GET  /api/stories/{story_id}/dialogue/stats        — aggregate stats for health dashboard
GET  /api/stories/{story_id}/dialogue/interactions — character interaction matrix
PATCH /api/dialogue/{block_id}                    — manually correct a block's attribution
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.dialogue import DialogueBlock
from ..models.character import Character
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


class ProposedDialogueTag(BaseModel):
    id: str
    quote_content: str
    inferred_speaker: str | None
    character_id: str | None
    confidence: float
    source_excerpt: str


class ApplyTagRequest(BaseModel):
    quote_content: str      # used to locate the quote in the HTML
    speaker_name: str       # name to append as <Name> suffix


class ApplyTagsBody(BaseModel):
    tags: list[ApplyTagRequest]


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


@router.post("/scenes/{scene_id}/dialogue/suggest-tags", response_model=list[ProposedDialogueTag])
def suggest_dialogue_tags(
    scene_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan scene for unattributed quotes and propose <Name> suffixes."""
    node = _get_scene(scene_id, db, current_user)
    if not node.content:
        return []

    # Resolve characters for this story to match inferred names → IDs
    characters = db.query(Character).filter(Character.story_id == node.story_id).all()
    char_by_name = {c.name.lower(): c for c in characters}

    # Parse plain text paragraphs from the HTML
    from ..services.dialogue_service import _html_to_paragraphs, _STANDALONE_QUOTE_RE, _MENTION_RE

    paragraphs = _html_to_paragraphs(node.content)

    proposals: list[ProposedDialogueTag] = []
    for para in paragraphs:
        # Skip paragraphs that already have explicit <Name> attribution
        if re.search(r'"[^"]+?"<[^>]+>', para) or re.search(r'\u201d<[^>]+>', para):
            continue

        mentions = [(m.start(), m.group(1).strip()) for m in _MENTION_RE.finditer(para)]
        for m in _STANDALONE_QUOTE_RE.finditer(para):
            content = (m.group(1) or m.group(2) or "").strip()
            if not content or len(content) < 2:
                continue

            q_pos = m.start()
            best_speaker: str | None = None
            best_dist = 999

            for m_pos, m_name in mentions:
                dist = abs(q_pos - m_pos)
                if dist < best_dist and dist <= 150:
                    best_dist = dist
                    best_speaker = m_name

            confidence = round(max(0.0, 1.0 - (best_dist / 150)), 2) if best_speaker else 0.0

            # Build source excerpt (~50 chars around the quote start)
            excerpt_start = max(0, q_pos - 25)
            excerpt_end = min(len(para), q_pos + len(content) + 30)
            excerpt = para[excerpt_start:excerpt_end]
            if excerpt_start > 0:
                excerpt = "…" + excerpt
            if excerpt_end < len(para):
                excerpt = excerpt + "…"

            char = char_by_name.get(best_speaker.lower()) if best_speaker else None

            proposals.append(ProposedDialogueTag(
                id=str(uuid.uuid4()),
                quote_content=content,
                inferred_speaker=best_speaker,
                character_id=char.id if char else None,
                confidence=confidence,
                source_excerpt=excerpt,
            ))

    return proposals


@router.post("/scenes/{scene_id}/dialogue/apply-tags")
def apply_dialogue_tags(
    scene_id: str,
    body: ApplyTagsBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply approved dialogue tag proposals by inserting <Name> suffixes into scene HTML."""
    node = _get_scene(scene_id, db, current_user)
    if not body.tags:
        return {"id": scene_id, "content": node.content}

    content = node.content or ""

    # Apply each tag: find `"quote_content"` (straight or smart) not already suffixed
    # and append `&lt;speaker_name&gt;` (entity-encoded, matching TipTap storage).
    # Process in an order that doesn't invalidate earlier positions — since we're
    # doing string substitutions on content strings (not offsets), this is safe.
    for tag in body.tags:
        q = re.escape(tag.quote_content)
        suffix = f"&lt;{tag.speaker_name}&gt;"
        # Match straight quotes not already followed by &lt;
        content = re.sub(
            rf'"({q})"(?!&lt;)',
            rf'"\1"{suffix}',
            content,
        )
        # Match smart quotes not already followed by &lt;
        content = re.sub(
            rf'\u201c({q})\u201d(?!&lt;)',
            rf'\u201c\1\u201d{suffix}',
            content,
        )

    node.content = content
    db.commit()

    # Re-sync dialogue blocks after content change
    sync_dialogue_blocks(scene_id, content, node.story_id, db)

    from ..schemas.structure import StructureNodeOut
    db.refresh(node)
    return StructureNodeOut.model_validate(node)


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
