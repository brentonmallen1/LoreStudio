"""
Publication preparation endpoints.

- POST /stories/{story_id}/chat/book-description   — streaming book jacket copy (conversational)
- POST /stories/{story_id}/chat/query-letter        — streaming query letter (conversational)
- POST /stories/{story_id}/publication/comp-titles  — one-shot comparable titles (structured)
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.ai_responses import CompTitlesResponse, StructuredResult
from ..schemas.llm_params import LLMParamsOverride
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.publication import (
    build_book_description_system_prompt,
    build_comp_titles_prompt,
    build_query_letter_system_prompt,
)
from ..services.llm.stream_errors import stream_error

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _build_publication_context(story: Story, db: Session) -> dict:
    """Assemble publication-relevant story context."""

    # Main characters (protagonists first, limited count)
    chars = db.query(Character).filter(Character.story_id == story.id).all()
    char_data = []
    for c in sorted(chars, key=lambda x: (0 if x.role in ("protagonist", "main") else 1, x.name)):
        d: dict = {"name": c.name, "role": c.role or ""}
        if c.motivation:
            d["motivation"] = c.motivation[:160]
        char_data.append(d)

    # Total word count from leaf scenes
    leaves = (
        db.query(StructureNode).filter(StructureNode.story_id == story.id, StructureNode.level_type == "scene").all()
    )
    total_words = sum(getattr(n, "word_count", 0) or 0 for n in leaves)

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "central_conflict": story.central_conflict or None,
            "narrative_intent": story.narrative_intent or getattr(story, "intent", None) or None,
            "logline": story.logline or None,
            "premise": story.premise or None,
            "target_audience": story.target_audience or None,
        },
        "characters": char_data[:6],
        "word_count": total_words or None,
        "intended_length": getattr(story, "intended_length", None),
    }


@router.post("/stories/{story_id}/chat/book-description")
async def book_description_chat(
    story_id: str,
    messages: list[dict] = Body(...),
    llm_params: LLMParamsOverride | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a conversational book jacket description drafting session."""
    story = _get_story(story_id, db, current_user)
    ctx = _build_publication_context(story, db)
    system_prompt = build_book_description_system_prompt(ctx)

    call_ctx = AICallContext(
        feature="book-description",
        user_id=current_user.id,
        story_id=story_id,
        tags=["publication", "book-description", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=system_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
                llm_params=llm_params,
            ):
                yield token
        except Exception as exc:
            yield stream_error(exc, where="publication")

    return StreamingResponse(stream(), media_type="text/plain")


@router.post("/stories/{story_id}/chat/query-letter")
async def query_letter_chat(
    story_id: str,
    messages: list[dict] = Body(...),
    llm_params: LLMParamsOverride | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a conversational query letter drafting session."""
    story = _get_story(story_id, db, current_user)
    ctx = _build_publication_context(story, db)
    system_prompt = build_query_letter_system_prompt(ctx)

    call_ctx = AICallContext(
        feature="query-letter",
        user_id=current_user.id,
        story_id=story_id,
        tags=["publication", "query-letter", "user-initiated"],
    )

    async def stream():
        try:
            async for token in ai_gateway.stream(
                messages=messages,
                feature_prompt=system_prompt,
                context=call_ctx,
                db=db,
                user=current_user,
                llm_params=llm_params,
            ):
                yield token
        except Exception as exc:
            yield stream_error(exc, where="publication")

    return StreamingResponse(stream(), media_type="text/plain")


@router.post("/stories/{story_id}/publication/comp-titles", response_model=StructuredResult)
async def suggest_comp_titles(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-shot AI: suggest comparable published titles for the story."""
    story = _get_story(story_id, db, current_user)

    feature_prompt = build_comp_titles_prompt(
        story_title=story.title,
        genre=story.genre,
        tone=story.tone,
        logline=story.logline,
        premise=story.premise,
        narrative_intent=story.narrative_intent or getattr(story, "intent", None),
        themes=story.themes or [],
        intended_length=getattr(story, "intended_length", None),
    )

    call_ctx = AICallContext(
        feature="comp-titles",
        user_id=current_user.id,
        story_id=story_id,
        tags=["publication", "comp-titles", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=CompTitlesResponse,
        messages=[{"role": "user", "content": "Suggest comparable published titles for this story."}],
        feature_prompt=feature_prompt,
        context=call_ctx,
        db=db,
        user=current_user,
    )
