"""
AI world building assistance endpoints.

Six features, all structured JSON output, all following the "guide not co-author" philosophy:
- What Would Exist Here?  — logical implications of a location's properties
- Element Suggestions     — brainstorming directions for culture/location elements
- Historical Implications — ripple effects of past events into the present day
- System Analysis         — edge cases and story implications of a world system
- Calendar Suggestions    — festivals, seasonal events, historical observances
- Travel Analysis         — journey considerations for a specific route
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.calendar import Calendar
from ..models.culture import Culture
from ..models.historical_event import HistoricalEvent
from ..models.location import Location
from ..models.location_travel import LocationTravel
from ..models.story import Story
from ..models.user import User
from ..models.world_system import WorldSystem
from ..schemas.ai_responses import (
    CalendarSuggestionsResponse,
    CultureElementSuggestionsResponse,
    HistoricalImplicationsResponse,
    LocationElementSuggestionsResponse,
    LocationExistenceResponse,
    StructuredResult,
    SystemAnalysisResponse,
    TravelAnalysisResponse,
)
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.worldbuilding import (
    build_calendar_suggestion_prompt,
    build_element_suggestion_prompt,
    build_historical_implication_prompt,
    build_location_existence_prompt,
    build_system_analysis_prompt,
    build_travel_analysis_prompt,
)
from ..services.worldbuilding_context import (
    build_calendar_context,
    build_culture_context,
    build_event_context,
    build_location_context,
    build_system_context,
    build_travel_context,
)

router = APIRouter()


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories/{story_id}/worldbuilding/what-exists", response_model=StructuredResult)
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
        extra_metadata={"entity_id": location_id},
        tags=["worldbuilding", "location", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=LocationExistenceResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/worldbuilding/suggest-elements", response_model=StructuredResult)
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
        world_ctx = build_culture_context(entity, story, db)
        element_dict = world_ctx["culture"]
        response_model = CultureElementSuggestionsResponse
    elif element_type == "location":
        entity = db.get(Location, element_id)
        if not entity or entity.story_id != story_id:
            raise HTTPException(status_code=404, detail="Location not found")
        world_ctx = build_location_context(entity, story, db)
        element_dict = world_ctx["location"]
        response_model = LocationElementSuggestionsResponse
    else:
        raise HTTPException(status_code=400, detail="element_type must be 'culture' or 'location'")

    feature_prompt = build_element_suggestion_prompt(element_dict, element_type, world_ctx)
    llm_messages = [{"role": "user", "content": f"Help me brainstorm elements for {entity.name}."}]

    ctx = AICallContext(
        feature="element-suggest",
        user_id=current_user.id,
        story_id=story_id,
        extra_metadata={"entity_id": element_id},
        tags=["worldbuilding", element_type, "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=response_model,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/worldbuilding/historical-implications", response_model=StructuredResult)
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
    llm_messages = [
        {"role": "user", "content": f"Help me think through the present-day implications of '{event.name}'."}
    ]

    ctx = AICallContext(
        feature="historical-implications",
        user_id=current_user.id,
        story_id=story_id,
        extra_metadata={"entity_id": event_id},
        tags=["worldbuilding", "history", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=HistoricalImplicationsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/worldbuilding/system-analysis", response_model=StructuredResult)
async def analyze_world_system(
    story_id: str,
    system_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    World System Analysis — surface edge cases, story implications, and consistency
    questions about a defined world system (magic, technology, powers, etc.).
    """
    story = _get_story(story_id, db, current_user)
    system = db.get(WorldSystem, system_id)
    if not system or system.story_id != story_id:
        raise HTTPException(status_code=404, detail="World system not found")

    system_ctx = build_system_context(system, story, db)
    feature_prompt = build_system_analysis_prompt(system_ctx)
    llm_messages = [{"role": "user", "content": f"Help me think through the implications of '{system.name}'."}]

    ctx = AICallContext(
        feature="system-analysis",
        user_id=current_user.id,
        story_id=story_id,
        extra_metadata={"entity_id": system_id},
        tags=["worldbuilding", "systems", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=SystemAnalysisResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/worldbuilding/calendar-suggestions", response_model=StructuredResult)
async def calendar_suggestions(
    story_id: str,
    calendar_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calendar Suggestions — brainstorm festivals, seasonal events, and historical
    observances that would logically exist in this calendar system.
    """
    story = _get_story(story_id, db, current_user)
    calendar = db.get(Calendar, calendar_id)
    if not calendar or calendar.story_id != story_id:
        raise HTTPException(status_code=404, detail="Calendar not found")

    calendar_ctx = build_calendar_context(calendar, story, db)
    feature_prompt = build_calendar_suggestion_prompt(calendar_ctx)
    llm_messages = [{"role": "user", "content": f"Help me think through special days for '{calendar.name}'."}]

    ctx = AICallContext(
        feature="calendar-suggestions",
        user_id=current_user.id,
        story_id=story_id,
        extra_metadata={"entity_id": calendar_id},
        tags=["worldbuilding", "calendar", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=CalendarSuggestionsResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/stories/{story_id}/worldbuilding/travel-analysis", response_model=StructuredResult)
async def analyze_travel_route(
    story_id: str,
    travel_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Travel Route Analysis — surface journey considerations, hazards, and narrative
    possibilities for a defined travel route between two locations.
    """
    story = _get_story(story_id, db, current_user)
    travel = db.get(LocationTravel, travel_id)
    if not travel:
        raise HTTPException(status_code=404, detail="Travel route not found")
    # Verify ownership via one of the locations
    from_loc = db.get(Location, travel.from_location_id)
    if not from_loc or from_loc.story_id != story_id:
        raise HTTPException(status_code=404, detail="Travel route not found")

    travel_ctx = build_travel_context(travel, story, db)
    from_name = travel_ctx["from_location"].get("name", "origin")
    to_name = travel_ctx["to_location"].get("name", "destination")
    feature_prompt = build_travel_analysis_prompt(travel_ctx)
    llm_messages = [{"role": "user", "content": f"Help me think through the journey from {from_name} to {to_name}."}]

    ctx = AICallContext(
        feature="travel-analysis",
        user_id=current_user.id,
        story_id=story_id,
        extra_metadata={"entity_id": travel_id},
        tags=["worldbuilding", "travel", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=TravelAnalysisResponse,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )
