"""
AI world building assistance endpoints.

Three features, all streaming, all following the "guide not co-author" philosophy:
- What Would Exist Here?  — logical implications of a location's properties
- Element Suggestions     — brainstorming directions for culture/location elements
- Historical Implications — ripple effects of past events into the present day

Each endpoint uses AICallContext for Chronicle logging and per-user prompt
customization via Settings > AI Prompts.
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.location import Location
from ..models.culture import Culture
from ..models.historical_event import HistoricalEvent
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.worldbuilding_context import (
    build_location_context,
    build_culture_context,
    build_event_context,
)
from ..services.llm.prompts.worldbuilding import (
    build_location_existence_prompt,
    build_element_suggestion_prompt,
    build_historical_implication_prompt,
)

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories/{story_id}/worldbuilding/what-exists")
async def what_would_exist_here(
    story_id: str,
    location_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    'What Would Exist Here?' — surface logical implications of a location's
    established properties: climate, terrain, world systems, cultural presence.
    """
    story = _get_story(story_id, db, current_user)
    location = db.get(Location, location_id)
    if not location or location.story_id != story_id:
        raise HTTPException(status_code=404, detail="Location not found")

    location_ctx = build_location_context(location, story, db)
    feature_prompt = build_location_existence_prompt(location_ctx)

    llm_messages = [{"role": "user", "content": f"Help me think through what would exist at {location.name}."}]

    ctx = AICallContext(
        feature="what-exists",
        user_id=current_user.id,
        story_id=story_id,
        entity_id=location_id,
        tags=["worldbuilding", "location", "user-initiated"],
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


@router.post("/stories/{story_id}/worldbuilding/suggest-elements")
async def suggest_world_elements(
    story_id: str,
    element_type: str = Body(..., embed=True),
    element_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Element brainstorming — suggest directions for names, customs, creatures,
    and other cultural/geographic elements.
    """
    story = _get_story(story_id, db, current_user)

    if element_type == "culture":
        entity = db.get(Culture, element_id)
        if not entity or entity.story_id != story_id:
            raise HTTPException(status_code=404, detail="Culture not found")
        from ..services.worldbuilding_context import build_culture_context as _build_culture_ctx
        world_ctx = _build_culture_ctx(entity, story, db)
        element_dict = world_ctx["culture"]
    elif element_type == "location":
        entity = db.get(Location, element_id)
        if not entity or entity.story_id != story_id:
            raise HTTPException(status_code=404, detail="Location not found")
        from ..services.worldbuilding_context import build_location_context as _build_loc_ctx
        world_ctx = _build_loc_ctx(entity, story, db)
        element_dict = world_ctx["location"]
    else:
        raise HTTPException(status_code=400, detail="element_type must be 'culture' or 'location'")

    feature_prompt = build_element_suggestion_prompt(element_dict, element_type, world_ctx)
    llm_messages = [{"role": "user", "content": f"Help me brainstorm elements for {entity.name}."}]

    ctx = AICallContext(
        feature="element-suggest",
        user_id=current_user.id,
        story_id=story_id,
        entity_id=element_id,
        tags=["worldbuilding", element_type, "user-initiated"],
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


@router.post("/stories/{story_id}/worldbuilding/historical-implications")
async def historical_implications(
    story_id: str,
    event_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Historical Implication Analysis — surface present-day ripple effects of a
    historical event: ruins, traditions, political structures, inherited attitudes.
    """
    story = _get_story(story_id, db, current_user)
    event = db.get(HistoricalEvent, event_id)
    if not event or event.story_id != story_id:
        raise HTTPException(status_code=404, detail="Historical event not found")

    event_ctx = build_event_context(event, story, db)
    feature_prompt = build_historical_implication_prompt(event_ctx)

    llm_messages = [{"role": "user", "content": f"Help me think through the present-day implications of '{event.name}'."}]

    ctx = AICallContext(
        feature="historical-implications",
        user_id=current_user.id,
        story_id=story_id,
        entity_id=event_id,
        tags=["worldbuilding", "history", "user-initiated"],
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
