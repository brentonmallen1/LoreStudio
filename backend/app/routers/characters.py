import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.activity_log import ActivityLog
from ..models.character import Character
from ..models.dialogue import DialogueBlock
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import (
    AttributeSuggestionsResponse,
    PronounIdentificationResponse,
    StructuredResult,
    VoiceFidelityResponse,
)
from ..schemas.character import (
    CharacterOut,
    CharacterUpdate,
    DiscoveryNoteCreate,
    DiscoveryNoteUpdate,
)
from ..schemas.refactoring import (
    ApplyPronounRefactorRequest,
    ApplyRenameRequest,
    PronounRefactorPreviewResponse,
    PronounRewriteProposal,
    RenamePreviewResponse,
)
from ..services import change_log
from ..services.character_journey import (
    build_journey_prompt,
    get_cached_journey,
    get_nodes_up_to,
    get_scenes_with_character,
    save_journey,
)
from ..services.linking_service import apply_entity_links, suggest_entity_links_preloaded
from ..services.llm.gateway import AICallContext, AICallResult, ai_gateway
from ..services.llm.prompts.analysis import build_voice_fidelity_prompt
from ..services.llm.prompts.generation import build_attribute_generation_prompt
from ..services.llm.prompts.pronoun_refactor import build_pronoun_identification_prompt
from ..services.nlp_analysis_service import analyze_character_dialogue_prose, analyze_voice_distinctness
from ..services.pronoun_service import apply_proposals_to_html, build_pronoun_proposals
from ..services.refactoring_service import apply_entity_rename, preview_entity_rename
from ..services.text_utils import html_to_text as _html_to_text

router = APIRouter()


def _verify_character_access(character_id: str, db: Session, user: User) -> Character:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    story = db.query(Story).filter(Story.id == character.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.get("/{character_id}", response_model=CharacterOut)
def get_character(character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _verify_character_access(character_id, db, current_user)


@router.patch("/{character_id}", response_model=CharacterOut)
def update_character(
    character_id: str,
    body: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    before, after = change_log.diff_fields(character, data)
    if before:
        change_log.record(
            db,
            story_id=character.story_id,
            entity_type="character",
            entity_id=character.id,
            action="update",
            before=before,
            after=after,
            label=f"Edit {', '.join(sorted(after))} on {character.name}",
            actor_id=current_user.id,
            client_id=client_id,
        )
    for key, value in data.items():
        setattr(character, key, value)
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    character = _verify_character_access(character_id, db, current_user)
    change_log.record(
        db,
        story_id=character.story_id,
        entity_type="character",
        entity_id=character.id,
        action="delete",
        before=change_log.capture_character(character, db),
        after=None,
        label=f"Delete character {character.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(character)
    db.commit()


@router.post("/{character_id}/generate-attributes", response_model=StructuredResult)
async def generate_attributes(
    character_id: str,
    attribute_type: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate structured AI attribute suggestions for a character."""
    character = _verify_character_access(character_id, db, current_user)
    feature_prompt = build_attribute_generation_prompt(character, attribute_type)
    llm_messages = [{"role": "user", "content": "Please provide your suggestions."}]

    ctx = AICallContext(
        feature="character-attributes",
        user_id=current_user.id,
        story_id=character.story_id,
        character_id=character_id,
        tags=["character", "generation", "lorebook", "user-initiated"],
        extra_metadata={"attribute_type": attribute_type},
    )

    return await ai_gateway.generate_structured(
        response_model=AttributeSuggestionsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


class DialogueBlockWithScene(BaseModel):
    id: str
    scene_id: str
    scene_title: str
    character_id: str | None
    speaker_name: str
    content: str
    attribution_method: str
    confidence: float
    paragraph_index: int

    model_config = {"from_attributes": True}


@router.get("/{character_id}/dialogue", response_model=list[DialogueBlockWithScene])
def get_character_dialogue(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all dialogue blocks for a character across all scenes, ordered by story position."""
    _verify_character_access(character_id, db, current_user)
    rows = (
        db.query(DialogueBlock, StructureNode.title, StructureNode.position)
        .join(StructureNode, DialogueBlock.scene_id == StructureNode.id)
        .filter(DialogueBlock.character_id == character_id)
        .order_by(StructureNode.position, DialogueBlock.paragraph_index, DialogueBlock.position_in_paragraph)
        .all()
    )
    result = []
    for block, scene_title, _ in rows:
        result.append(
            DialogueBlockWithScene(
                id=block.id,
                scene_id=block.scene_id,
                scene_title=scene_title or "Untitled",
                character_id=block.character_id,
                speaker_name=block.speaker_name,
                content=block.content,
                attribution_method=block.attribution_method,
                confidence=block.confidence,
                paragraph_index=block.paragraph_index,
            )
        )
    return result


@router.get("/{character_id}/journey")
def get_character_journey(
    character_id: str,
    up_to_node: str = Query(..., description="Node ID to use as the 'current point in story'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a cached character journey summary up to the given node.
    If no cache exists yet, returns empty summary with scene_count.
    """
    character = _verify_character_access(character_id, db, current_user)
    node = db.get(StructureNode, up_to_node)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    cached = get_cached_journey(character_id, up_to_node, db)
    nodes_up_to = get_nodes_up_to(node.story_id, up_to_node, db)
    relevant_scenes = get_scenes_with_character(nodes_up_to, character)

    if cached:
        return {
            "summary": cached.summary,
            "is_stale": cached.is_stale,
            "scene_count": len(relevant_scenes),
            "generated_at": cached.updated_at.replace(tzinfo=UTC).isoformat(),
        }
    return {
        "summary": "",
        "is_stale": False,
        "scene_count": len(relevant_scenes),
        "generated_at": None,
    }


@router.post("/{character_id}/journey/refresh")
async def refresh_character_journey(
    character_id: str,
    up_to_node: str = Query(..., description="Node ID to use as the 'current point in story'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force-regenerate the character journey summary up to the given node.
    Streams the LLM response and saves to cache on completion.
    """
    character = _verify_character_access(character_id, db, current_user)
    node = db.get(StructureNode, up_to_node)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    nodes_up_to = get_nodes_up_to(node.story_id, up_to_node, db)
    relevant_scenes = get_scenes_with_character(nodes_up_to, character)

    if not relevant_scenes:
        from fastapi.responses import Response

        # Still cache a placeholder so the UI can show "0 scenes found"
        cached = get_cached_journey(character_id, up_to_node, db)
        placeholder = "I don't appear to have experienced anything notable in the story up to this point."
        save_journey(character_id, up_to_node, placeholder, [], db, existing=cached)
        return Response(placeholder, media_type="text/plain")

    scene_summaries = [(n.title, n.content_summary) for n in relevant_scenes]
    source_ids = [n.id for n in relevant_scenes]
    feature_prompt = build_journey_prompt(character, scene_summaries)
    llm_messages = [{"role": "user", "content": "Please provide the journey summary."}]

    cached = get_cached_journey(character_id, up_to_node, db)

    ctx = AICallContext(
        feature="character-journey",
        user_id=current_user.id,
        story_id=node.story_id,
        character_id=character_id,
        node_id=up_to_node,
        tags=["character", "journey", "lorebook", "user-initiated", "persisted"],
    )

    async def on_complete(result: AICallResult) -> None:
        save_journey(character_id, up_to_node, result.content, source_ids, db, existing=cached)

    async def stream_and_persist():
        async for token in ai_gateway.stream(
            messages=llm_messages,
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
            include_core_prompt=False,
            on_complete=on_complete,
        ):
            yield token

    return StreamingResponse(stream_and_persist(), media_type="text/plain")


@router.get("/{character_id}/arc-timeline")
def get_arc_timeline(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return ordered leaf scenes where this character appears, plus milestone data.
    Used by the Arc Journey timeline visualization.
    """
    character = _verify_character_access(character_id, db, current_user)

    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == character.story_id).all()

    # Build ordered leaf nodes
    children_map: dict[str, list] = {}
    roots = []
    for n in all_nodes:
        if n.parent_id:
            children_map.setdefault(n.parent_id, []).append(n)
        else:
            roots.append(n)

    def flatten_leaves(nodes):
        result = []
        for n in sorted(nodes, key=lambda x: x.position):
            kids = children_map.get(n.id, [])
            if not kids:
                result.append(n)
            else:
                result.extend(flatten_leaves(kids))
        return result

    leaves = flatten_leaves(roots)

    name_lower = character.name.lower()
    scenes = []
    for i, n in enumerate(leaves):
        if n.content and name_lower in n.content.lower():
            linked_milestones = [m["id"] for m in (character.arc_milestones or []) if m.get("scene_id") == n.id]
            scenes.append(
                {
                    "id": n.id,
                    "title": n.title or "Untitled",
                    "position": i,
                    "word_count": n.word_count,
                    "status": n.status,
                    "linked_milestones": linked_milestones,
                }
            )

    total_leaves = len(leaves)
    appearance_rate = round(len(scenes) / total_leaves * 100, 1) if total_leaves > 0 else 0.0

    return {
        "character_id": character.id,
        "character_name": character.name,
        "scenes": scenes,
        "milestones": character.arc_milestones or [],
        "appearance_rate": appearance_rate,
        "total_scenes": total_leaves,
    }


@router.post("/{character_id}/preview-rename", response_model=RenamePreviewResponse)
def preview_character_rename(
    character_id: str,
    new_name: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview which scenes would be affected by renaming this character."""
    character = _verify_character_access(character_id, db, current_user)
    if not new_name.strip():
        raise HTTPException(status_code=400, detail="new_name is required")
    affected = preview_entity_rename("character", character.name, new_name.strip(), character.story_id, db)
    return RenamePreviewResponse(
        entity_type="character",
        old_name=character.name,
        new_name=new_name.strip(),
        affected_scenes=affected,
        total_occurrences=sum(s.occurrences for s in affected),
    )


@router.post("/{character_id}/apply-rename", response_model=CharacterOut)
def apply_character_rename(
    character_id: str,
    body: ApplyRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename character and propagate change to selected scenes."""
    character = _verify_character_access(character_id, db, current_user)
    # Apply prose changes first
    apply_entity_rename("character", body.old_name, body.new_name, body.node_ids, db)
    # Update character name
    character.name = body.new_name
    db.commit()
    db.refresh(character)
    return character


@router.post("/{character_id}/preview-pronoun-refactor", response_model=PronounRefactorPreviewResponse)
async def preview_pronoun_refactor(
    character_id: str,
    new_pronouns: str = Body(..., embed=True),
    node_ids: list[str] = Body(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview pronoun changes across scenes.

    The LLM identifies which pronouns refer to this character (identification only,
    no prose generation). Deterministic substitution + spaCy conjugation fixing
    compute the actual replacements.
    """
    character = _verify_character_access(character_id, db, current_user)
    if not new_pronouns.strip():
        raise HTTPException(status_code=400, detail="new_pronouns is required")

    # Determine which scenes to scan
    if node_ids:
        nodes = db.query(StructureNode).filter(StructureNode.id.in_(node_ids)).all()
    else:
        nodes = (
            db.query(StructureNode)
            .filter(
                StructureNode.story_id == character.story_id,
                StructureNode.content != "",
            )
            .all()
        )
    name_lower = character.name.lower()
    scenes_to_scan = [n for n in nodes if n.content and name_lower in n.content.lower()]

    proposals: list[PronounRewriteProposal] = []
    for node in scenes_to_scan:
        plain_text = _html_to_text(node.content)

        # Step 1: LLM identifies which pronouns refer to this character
        feature_prompt = build_pronoun_identification_prompt(
            character_name=character.name,
            scene_content=plain_text,
        )
        ctx = AICallContext(
            feature="pronoun-identification",
            user_id=current_user.id,
            story_id=character.story_id,
            character_id=character_id,
            node_id=node.id,
            tags=["character", "pronouns", "identification", "user-initiated"],
        )
        result = await ai_gateway.generate_structured(
            response_model=PronounIdentificationResponse,
            messages=[{"role": "user", "content": "Please identify the pronouns."}],
            feature_prompt=feature_prompt,
            context=ctx,
            db=db,
            user=current_user,
        )

        if not result.success or not result.data:
            continue

        instances = result.data.get("instances", [])

        # Step 2: Deterministic substitution — compute what each identified pronoun becomes
        scene_proposals = build_pronoun_proposals(instances, plain_text, new_pronouns.strip())
        for prop in scene_proposals:
            proposals.append(
                PronounRewriteProposal(
                    id=str(uuid.uuid4()),
                    node_id=node.id,
                    node_title=node.title or "(Untitled)",
                    original=prop["original"],
                    rewritten=prop["rewritten"],
                    explanation=prop["explanation"],
                )
            )

    return PronounRefactorPreviewResponse(
        character_id=character.id,
        character_name=character.name,
        old_pronouns=character.pronouns or "",
        new_pronouns=new_pronouns.strip(),
        proposals=proposals,
        scenes_scanned=len(scenes_to_scan),
    )


@router.post("/{character_id}/apply-pronoun-refactor", response_model=CharacterOut)
def apply_pronoun_refactor(
    character_id: str,
    body: ApplyPronounRefactorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply selected pronoun rewrites to scenes and update character pronouns."""
    character = _verify_character_access(character_id, db, current_user)

    from collections import defaultdict

    by_node: dict[str, list] = defaultdict(list)
    for rw in body.rewrites:
        by_node[rw.node_id].append(rw)

    for node_id, rewrites in by_node.items():
        node = db.get(StructureNode, node_id)
        if not node:
            continue
        props = [{"original": rw.original, "rewritten": rw.rewritten} for rw in rewrites]
        new_content = apply_proposals_to_html(node.content, props, body.new_pronouns)
        if new_content != node.content:
            node.content = new_content
            node.summary_stale = True

    character.pronouns = body.new_pronouns
    db.commit()
    db.refresh(character)
    return character


class UnlinkedMentionProposal(BaseModel):
    id: str
    matched_text: str
    confidence: float
    source_excerpt: str


class SceneWithUnlinkedMentions(BaseModel):
    scene_id: str
    scene_title: str
    proposals: list[UnlinkedMentionProposal]


class CharacterUnlinkedMentionsResponse(BaseModel):
    character_id: str
    character_name: str
    total_unlinked: int
    scenes: list[SceneWithUnlinkedMentions]


@router.get("/{character_id}/unlinked-mentions", response_model=CharacterUnlinkedMentionsResponse)
def get_character_unlinked_mentions(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find all unlinked mentions of this character across the story's scenes."""
    character = _verify_character_access(character_id, db, current_user)

    all_leaves = (
        db.query(StructureNode)
        .filter(
            StructureNode.story_id == character.story_id,
            StructureNode.content.isnot(None),
            StructureNode.content != "",
        )
        .all()
    )

    # Only scan leaf nodes (no children)
    child_ids = {n.parent_id for n in all_leaves if n.parent_id}
    scenes = [n for n in all_leaves if n.id not in child_ids]

    # Pre-load entities once so suggest_entity_links doesn't query DB per scene
    from ..models.character import Character as _Char
    from ..models.location import Location as _Loc

    _all_chars = db.query(_Char).filter(_Char.story_id == character.story_id).all()
    _all_locs = db.query(_Loc).filter(_Loc.story_id == character.story_id).all()

    results: list[SceneWithUnlinkedMentions] = []
    for scene in scenes:
        all_proposals = suggest_entity_links_preloaded(scene.content, _all_chars, _all_locs)
        char_proposals = [
            p for p in all_proposals if p["entity_type"] == "character" and p["entity_id"] == character_id
        ]
        if char_proposals:
            results.append(
                SceneWithUnlinkedMentions(
                    scene_id=scene.id,
                    scene_title=scene.title or "Untitled",
                    proposals=[
                        UnlinkedMentionProposal(
                            id=p["id"],
                            matched_text=p["matched_text"],
                            confidence=p["confidence"],
                            source_excerpt=p["source_excerpt"],
                        )
                        for p in char_proposals
                    ],
                )
            )

    total = sum(len(s.proposals) for s in results)
    return CharacterUnlinkedMentionsResponse(
        character_id=character_id,
        character_name=character.name,
        total_unlinked=total,
        scenes=results,
    )


class ApplyMentionItem(BaseModel):
    id: str
    matched_text: str


class ApplyMentionsForScene(BaseModel):
    scene_id: str
    proposals: list[ApplyMentionItem]


class ApplyMentionsRequest(BaseModel):
    scenes: list[ApplyMentionsForScene]


@router.post("/{character_id}/apply-mentions")
def apply_character_mentions(
    character_id: str,
    body: ApplyMentionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply selected mention tags to scene content."""
    character = _verify_character_access(character_id, db, current_user)
    updated_count = 0

    for scene_data in body.scenes:
        node = db.get(StructureNode, scene_data.scene_id)
        if not node or node.story_id != character.story_id:
            continue
        links = [
            {
                "matched_text": p.matched_text,
                "entity_name": character.name,
                "entity_type": "character",
            }
            for p in scene_data.proposals
        ]
        new_content = apply_entity_links(node.content, links)
        if new_content != node.content:
            node.content = new_content
            node.summary_stale = True
            updated_count += 1

    db.commit()
    return {"updated_scenes": updated_count}


@router.post("/{character_id}/analyze-voice")
def analyze_character_voice(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze this character's dialogue voice profile compared to other characters in the story."""
    character = _verify_character_access(character_id, db, current_user)

    # Get all characters in the story
    all_characters = db.query(Character).filter(Character.story_id == character.story_id).all()

    # Fetch all dialogue blocks in one query, then group in Python
    char_ids = [c.id for c in all_characters]
    all_blocks = db.query(DialogueBlock).filter(DialogueBlock.character_id.in_(char_ids)).all()
    blocks_by_char: dict[str, list[DialogueBlock]] = {}
    for b in all_blocks:
        if b.character_id:
            blocks_by_char.setdefault(b.character_id, []).append(b)

    char_map = {c.id: c for c in all_characters}
    dialogue_inputs = []
    for char_id, blocks in blocks_by_char.items():
        char = char_map[char_id]
        combined_text = " ".join(b.content for b in blocks if b.content)
        if combined_text.strip():
            dialogue_inputs.append(
                {
                    "character_id": char.id,
                    "character_name": char.name,
                    "content": combined_text,
                }
            )

    if not dialogue_inputs:
        return {
            "profiles": [],
            "similar_pairs": [],
            "overall_distinctness": "distinct",
            "focus_character_id": character_id,
        }

    result = analyze_voice_distinctness(dialogue_inputs)
    result["focus_character_id"] = character_id
    return result


@router.post("/{character_id}/discovery-notes", response_model=CharacterOut)
def add_discovery_note(
    character_id: str,
    body: DiscoveryNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a discovery note with optional scene link."""
    character = _verify_character_access(character_id, db, current_user)
    notes = list(character.discovery_notes or [])
    notes.append(
        {
            "id": str(uuid.uuid4()),
            "text": body.text,
            "scene_id": body.scene_id,
            "scene_title": body.scene_title,
            "timestamp": datetime.now(UTC).isoformat(),
            "confirmed": False,
        }
    )
    character.discovery_notes = notes
    flag_modified(character, "discovery_notes")
    db.commit()
    db.refresh(character)
    return character


@router.patch("/{character_id}/discovery-notes/{note_id}", response_model=CharacterOut)
def update_discovery_note(
    character_id: str,
    note_id: str,
    body: DiscoveryNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm or edit a discovery note."""
    character = _verify_character_access(character_id, db, current_user)
    notes = list(character.discovery_notes or [])
    for note in notes:
        if note["id"] == note_id:
            if body.text is not None:
                note["text"] = body.text
            if body.confirmed is not None:
                note["confirmed"] = body.confirmed
            if body.scene_id is not None:
                note["scene_id"] = body.scene_id
            if body.scene_title is not None:
                note["scene_title"] = body.scene_title
            break
    character.discovery_notes = notes
    flag_modified(character, "discovery_notes")
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}/discovery-notes/{note_id}", response_model=CharacterOut)
def delete_discovery_note(
    character_id: str,
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a discovery note."""
    character = _verify_character_access(character_id, db, current_user)
    character.discovery_notes = [n for n in (character.discovery_notes or []) if n["id"] != note_id]
    flag_modified(character, "discovery_notes")
    db.commit()
    db.refresh(character)
    return character


@router.post("/{character_id}/analyze-dialogue")
def analyze_character_dialogue_endpoint(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run NLP prose analysis on this character's dialogue lines only."""
    _verify_character_access(character_id, db, current_user)
    blocks = db.query(DialogueBlock).filter(DialogueBlock.character_id == character_id).all()
    if not blocks:
        return {"word_count": 0, "line_count": 0}

    dialogue_texts = [b.content for b in blocks if b.content]
    return analyze_character_dialogue_prose(dialogue_texts)


@router.post("/{character_id}/analyze-voice-fidelity", response_model=StructuredResult)
async def analyze_voice_fidelity(
    character_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI analysis of whether character dialogue is authentic to their defined attributes."""
    character = _verify_character_access(character_id, db, current_user)

    blocks = db.query(DialogueBlock).filter(DialogueBlock.character_id == character_id).all()
    if not blocks:
        return StructuredResult(
            success=False,
            raw_text="No dialogue found for this character.",
        )

    dialogue_lines = [b.content for b in blocks if b.content]
    attributes = character.attributes or {}

    feature_prompt = build_voice_fidelity_prompt(
        character_name=character.name,
        attributes=attributes,
        dialogue_lines=dialogue_lines,
    )

    ctx = AICallContext(
        feature="voice-fidelity",
        user_id=current_user.id,
        story_id=character.story_id,
        tags=["character", "dialogue", "analysis", "user-initiated"],
    )

    result = await ai_gateway.generate_structured(
        response_model=VoiceFidelityResponse,
        messages=[{"role": "user", "content": f"Evaluate the voice fidelity of {character.name}'s dialogue."}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )

    log = ActivityLog(
        user_id=current_user.id,
        story_id=character.story_id,
        event_type="analysis_run",
        category="health",
        description=f"Voice fidelity analysis for {character.name}",
        metadata_={
            "feature": "voice-fidelity",
            "character_id": character_id,
            "character_name": character.name,
            "result": result.model_dump() if hasattr(result, "model_dump") else result,
        },
    )
    db.add(log)
    db.commit()
    return result
