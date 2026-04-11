"""
Dialogue API endpoints.

GET  /api/scenes/{scene_id}/dialogue              — list dialogue blocks for a scene
POST /api/scenes/{scene_id}/dialogue/refresh       — re-extract from current content
POST /api/scenes/{scene_id}/dialogue/suggest-tags  — propose <Name> suffixes for untagged quotes (heuristic)
POST /api/scenes/{scene_id}/dialogue/ai-suggest    — AI-powered speaker attribution using LLM
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
from ..services.dialogue_service import sync_dialogue_blocks, get_dialogue_stats, get_interaction_matrix, _html_to_paragraphs
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.analysis import build_dialogue_attribution_prompt
from ..schemas.ai_responses import DialogueAttributionResponse
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
    dialogue_type: str | None = None
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
    story = db.get(Story, node.story_id)
    pov_char_id = node.pov_character_id or (story.pov_character_id if story else None)
    narrative_perspective = story.narrative_perspective if story else ""
    return sync_dialogue_blocks(
        scene_id, node.content, node.story_id, db,
        pov_character_id=pov_char_id,
        narrative_perspective=narrative_perspective,
    )


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


@router.post("/scenes/{scene_id}/dialogue/ai-suggest", response_model=list[ProposedDialogueTag])
async def ai_suggest_dialogue_speakers(
    scene_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Use the LLM to infer speakers for unattributed dialogue in a scene.

    Returns a list of ProposedDialogueTag objects (same format as suggest-tags)
    so the frontend can display and apply them with the same workflow.
    """
    node = _get_scene(scene_id, db, current_user)
    if not node.content:
        return []

    # Build clean plain-text version of the scene
    paragraphs = _html_to_paragraphs(node.content)
    scene_text = "\n\n".join(paragraphs)

    # Character list
    characters = db.query(Character).filter(Character.story_id == node.story_id).all()
    char_by_name = {c.name.lower(): c for c in characters}
    character_list = "\n".join(
        f"- {c.name}" + (f" ({c.role})" if c.role else "") for c in characters
    )

    # Already-attributed dialogue (for voice context)
    already_attributed_lines = []
    for para in paragraphs:
        for m in re.finditer(r'"([^"]+)"<([^>]+)>', para):
            already_attributed_lines.append(f'{m.group(2)}: "{m.group(1)}"')
        for m in re.finditer(r'\u201c([^\u201d]+)\u201d<([^>]+)>', para):
            already_attributed_lines.append(f'{m.group(2)}: "\u201c{m.group(1)}\u201d"')
    already_attributed = "\n".join(already_attributed_lines[:20])  # cap context length

    # POV context for first-person narratives
    story = db.get(Story, node.story_id)
    narrative_perspective = story.narrative_perspective if story else ""
    pov_char_id = node.pov_character_id or (story.pov_character_id if story else None)
    pov_character_name = ""
    if pov_char_id:
        pov_char = db.get(Character, pov_char_id)
        if pov_char:
            pov_character_name = pov_char.name

    feature_prompt = build_dialogue_attribution_prompt(
        scene_text, character_list, already_attributed,
        pov_character=pov_character_name,
        narrative_perspective=narrative_perspective,
    )

    call_ctx = AICallContext(
        feature="dialogue-attribution",
        user_id=current_user.id,
        story_id=node.story_id,
        node_id=scene_id,
        tags=["manuscript", "dialogue", "attribution", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=DialogueAttributionResponse,
        messages=[{"role": "user", "content": "Identify the speaker for each unattributed dialogue quote."}],
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
    )

    if not result.success or not result.data:
        return []

    suggestions = result.data.get("suggestions", [])
    proposals: list[ProposedDialogueTag] = []
    for s in suggestions:
        quote_text = s.get("quote_text", "")
        speaker = s.get("suggested_speaker", "")
        confidence = float(s.get("confidence", 0.5))
        reasoning = s.get("reasoning", "")

        if not quote_text or not speaker:
            continue

        char = char_by_name.get(speaker.lower())

        # Build a short excerpt showing context (just use the quote for now)
        proposals.append(ProposedDialogueTag(
            id=str(uuid.uuid4()),
            quote_content=quote_text,
            inferred_speaker=speaker,
            character_id=char.id if char else None,
            confidence=min(1.0, max(0.0, confidence)),
            source_excerpt=reasoning[:120] if reasoning else "",
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
    story = db.get(Story, node.story_id)
    pov_char_id = node.pov_character_id or (story.pov_character_id if story else None)
    narrative_perspective = story.narrative_perspective if story else ""
    sync_dialogue_blocks(
        scene_id, content, node.story_id, db,
        pov_character_id=pov_char_id,
        narrative_perspective=narrative_perspective,
    )

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
