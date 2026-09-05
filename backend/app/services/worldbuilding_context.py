"""
World building context assembly for AI features.

Builds structured context packets from world building entities,
similar to _build_context_packet() in chat.py but focused on
world elements rather than scene elements.
"""

from sqlalchemy.orm import Session

from ..models.story import Story
from ..models.location import Location
from ..models.world_system import WorldSystem
from ..models.culture import Culture
from ..models.historical_event import Era, HistoricalEvent
from ..models.calendar import Calendar
from ..models.location_travel import LocationTravel


def _location_to_dict(loc: Location) -> dict:
    d = {
        "name": loc.name,
        "type": loc.location_type or None,
        "climate": loc.climate or None,
        "terrain": loc.terrain or None,
        "political_affiliation": loc.political_affiliation or None,
        "description": loc.description or None,
        "atmosphere": loc.atmosphere or None,
        "history": loc.history or None,
        "significance": loc.significance or None,
    }
    # Celestial properties — only include if set
    celestial = {
        "orbital_period": loc.orbital_period or None,
        "distance_from_parent": loc.distance_from_parent or None,
        "gravity": loc.gravity or None,
        "habitability": loc.habitability or None,
        "radiation_level": loc.radiation_level or None,
    }
    populated = {k: v for k, v in celestial.items() if v}
    if populated:
        d["celestial"] = populated
    return {k: v for k, v in d.items() if v is not None}


def build_world_context(story: Story, db: Session) -> dict:
    """
    Assemble full world context for AI features.
    Returns story metadata plus all world building entities.
    """
    systems = db.query(WorldSystem).filter(WorldSystem.story_id == story.id).all()
    locations = db.query(Location).filter(Location.story_id == story.id, Location.parent_id.is_(None)).all()
    cultures = db.query(Culture).filter(Culture.story_id == story.id).all()
    eras = db.query(Era).filter(Era.story_id == story.id).order_by(Era.position).all()
    events = db.query(HistoricalEvent).filter(HistoricalEvent.story_id == story.id).all()

    def location_tree(loc: Location, depth: int = 0) -> dict:
        d = _location_to_dict(loc)
        d["depth"] = depth
        if loc.children:
            d["children"] = [location_tree(c, depth + 1) for c in loc.children]
        return d

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "central_conflict": story.central_conflict or None,
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "world_systems": [
            {
                "name": s.name,
                "type": s.system_type or None,
                "source_origin": s.source_origin or None,
                "rules": s.rules or None,
                "limitations": s.limitations or None,
                "costs": s.costs or None,
                "tiers": s.hierarchy_tiers or [],
            }
            for s in systems
        ],
        "locations": [location_tree(loc) for loc in locations],
        "cultures": [
            {
                "name": c.name,
                "description": c.description or None,
                "values": c.values or None,
                "customs": c.customs or None,
                "taboos": c.taboos or None,
                "religion": c.religion or None,
                "government_type": c.government_type or None,
                "economy": c.economy or None,
                "social_hierarchy": c.social_hierarchy or None,
            }
            for c in cultures
        ],
        "eras": [
            {
                "name": e.name,
                "start_date": e.start_date or None,
                "end_date": e.end_date or None,
                "characteristics": e.characteristics or None,
            }
            for e in eras
        ],
        "historical_events": [
            {
                "name": ev.name,
                "description": ev.description or None,
                "in_world_date": ev.in_world_date or None,
                "causes": ev.causes or None,
                "consequences": ev.consequences or None,
                "legacy_effects": ev.legacy_effects or None,
                "era": next((e.name for e in eras if e.id == ev.era_id), None),
            }
            for ev in events
        ],
    }


def build_location_context(location: Location, story: Story, db: Session) -> dict:
    """
    Context focused on a specific location and its relationships:
    parent chain, world systems, cultures, historical events that mention it.
    """
    # Build parent chain
    parent_chain = []
    cursor = location.parent
    while cursor:
        parent_chain.insert(0, {"name": cursor.name, "type": cursor.location_type or None})
        cursor = cursor.parent

    # All world systems (environment shapes what exists)
    systems = db.query(WorldSystem).filter(WorldSystem.story_id == story.id).all()
    cultures = db.query(Culture).filter(Culture.story_id == story.id).all()
    events = db.query(HistoricalEvent).filter(HistoricalEvent.story_id == story.id).all()

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "location": _location_to_dict(location),
        "parent_chain": parent_chain,
        "children": [_location_to_dict(c) for c in location.children] if location.children else [],
        "world_systems": [
            {
                "name": s.name,
                "type": s.system_type or None,
                "rules": s.rules or None,
                "limitations": s.limitations or None,
                "costs": s.costs or None,
            }
            for s in systems
        ],
        "cultures": [
            {
                "name": c.name,
                "values": c.values or None,
                "customs": c.customs or None,
                "religion": c.religion or None,
                "government_type": c.government_type or None,
            }
            for c in cultures
        ],
        "historical_events": [
            {
                "name": ev.name,
                "description": ev.description or None,
                "legacy_effects": ev.legacy_effects or None,
            }
            for ev in events
            if ev.description or ev.legacy_effects
        ],
    }


def build_culture_context(culture: Culture, story: Story, db: Session) -> dict:
    """
    Context focused on a specific culture and related world elements.
    """
    systems = db.query(WorldSystem).filter(WorldSystem.story_id == story.id).all()
    locations = db.query(Location).filter(
        Location.story_id == story.id, Location.parent_id.is_(None)
    ).all()

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "culture": {
            "name": culture.name,
            "description": culture.description or None,
            "values": culture.values or None,
            "customs": culture.customs or None,
            "taboos": culture.taboos or None,
            "religion": culture.religion or None,
            "government_type": culture.government_type or None,
            "economy": culture.economy or None,
            "social_hierarchy": culture.social_hierarchy or None,
            "naming_conventions": culture.naming_conventions or {},
            "common_phrases": culture.common_phrases or [],
        },
        "world_systems": [
            {
                "name": s.name,
                "type": s.system_type or None,
                "rules": s.rules or None,
                "limitations": s.limitations or None,
            }
            for s in systems
        ],
        "locations": [
            {"name": loc.name, "type": loc.location_type or None, "climate": loc.climate or None}
            for loc in locations
        ],
    }


def build_system_context(system: WorldSystem, story: Story, db: Session) -> dict:
    """Context focused on a world system for AI analysis."""
    other_systems = db.query(WorldSystem).filter(
        WorldSystem.story_id == story.id, WorldSystem.id != system.id
    ).all()
    cultures = db.query(Culture).filter(Culture.story_id == story.id).all()

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "system": {
            "name": system.name,
            "type": system.system_type or None,
            "source_origin": system.source_origin or None,
            "rules": system.rules or None,
            "limitations": system.limitations or None,
            "costs": system.costs or None,
            "tiers": system.hierarchy_tiers or [],
            "notes": system.notes or None,
        },
        "other_systems": [
            {"name": s.name, "type": s.system_type or None, "rules": s.rules or None}
            for s in other_systems
        ],
        "cultures": [
            {"name": c.name, "government_type": c.government_type or None, "values": c.values or None}
            for c in cultures
        ],
    }


def build_calendar_context(calendar: Calendar, story: Story, db: Session) -> dict:
    """Context focused on a calendar for AI suggestions."""
    cultures = db.query(Culture).filter(Culture.story_id == story.id).all()
    events = db.query(HistoricalEvent).filter(HistoricalEvent.story_id == story.id).all()

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "calendar": {
            "name": calendar.name,
            "description": calendar.description or None,
            "months": calendar.months or [],
            "days_per_week": calendar.days_per_week or 7,
            "week_day_names": calendar.week_day_names or [],
            "special_days": calendar.special_days or [],
            "epoch_name": calendar.epoch_name or None,
        },
        "cultures": [
            {
                "name": c.name,
                "religion": c.religion or None,
                "values": c.values or None,
                "customs": c.customs or None,
            }
            for c in cultures
        ],
        "historical_events": [
            {"name": ev.name, "description": ev.description or None, "in_world_date": ev.in_world_date or None}
            for ev in events
            if ev.name
        ],
    }


def build_travel_context(travel: LocationTravel, story: Story, db: Session) -> dict:
    """Context for analyzing a travel route between two locations."""
    from_loc = db.get(Location, travel.from_location_id)
    to_loc = db.get(Location, travel.to_location_id)
    systems = db.query(WorldSystem).filter(WorldSystem.story_id == story.id).all()

    def loc_dict(loc: Location | None) -> dict:
        if not loc:
            return {}
        return {
            "name": loc.name,
            "type": loc.location_type or None,
            "climate": loc.climate or None,
            "terrain": loc.terrain or None,
            "political_affiliation": loc.political_affiliation or None,
        }

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "from_location": loc_dict(from_loc),
        "to_location": loc_dict(to_loc),
        "travel": {
            "travel_time": travel.travel_time or None,
            "travel_method": travel.travel_method or None,
            "condition": travel.condition or None,
            "notes": travel.notes or None,
        },
        "world_systems": [
            {"name": s.name, "type": s.system_type or None, "rules": s.rules or None}
            for s in systems
        ],
    }


def build_event_context(event: HistoricalEvent, story: Story, db: Session) -> dict:
    """
    Context focused on a historical event and its broader world setting.
    """
    era = event.era
    cultures = db.query(Culture).filter(Culture.story_id == story.id).all()
    systems = db.query(WorldSystem).filter(WorldSystem.story_id == story.id).all()

    # Other events in the same era for context
    era_events: list[HistoricalEvent] = []
    if era:
        era_events = [e for e in era.events if e.id != event.id]

    return {
        "story": {
            "title": story.title,
            "genre": story.genre or None,
            "tone": story.tone or None,
            "themes": story.themes or [],
            "narrative_intent": story.narrative_intent or story.intent or None,
        },
        "event": {
            "name": event.name,
            "description": event.description or None,
            "in_world_date": event.in_world_date or None,
            "causes": event.causes or None,
            "consequences": event.consequences or None,
            "legacy_effects": event.legacy_effects or None,
            "participants": event.participants or [],
        },
        "era": {
            "name": era.name,
            "start_date": era.start_date or None,
            "end_date": era.end_date or None,
            "characteristics": era.characteristics or None,
        } if era else None,
        "era_events": [
            {"name": e.name, "description": e.description or None}
            for e in era_events
        ],
        "cultures": [
            {
                "name": c.name,
                "values": c.values or None,
                "government_type": c.government_type or None,
            }
            for c in cultures
        ],
        "world_systems": [
            {"name": s.name, "type": s.system_type or None, "rules": s.rules or None}
            for s in systems
        ],
    }
