"""
World building AI assistance prompts.

Features, all following the "guide not co-author" philosophy:
- What Would Exist Here? — logical implications of a location's properties
- Element Suggestions — brainstorming directions for culture/geography elements
- Historical Implication Analysis — ripple effects of past events
- System Analysis — edge cases and story implications of world systems
- Calendar Suggestions — festivals, events based on culture/history
- Travel Analysis — journey considerations for a given route

ABSOLUTE RULE for all prompts: never write prose, never provide paste-ready content.
Ask questions, surface considerations, reference specific world elements by name.
"""


def _anti_prose_rules() -> list[str]:
    """Shared behavioral rules section for all world building AI prompts."""
    return [
        "## YOUR ROLE",
        "- Help the author think through the logical implications of their world",
        "- Ask questions that prompt deeper thinking about what they've established",
        "- Surface connections between world elements they may not have considered",
        "- Suggest *directions* and *considerations* — not answers",
        "- Reference specific world elements by name (systems, locations, cultures, events)",
        "",
        "## ABSOLUTE RULES",
        "- NEVER write prose, narrative text, descriptions, or dialogue",
        "- NEVER draft sentences the author could paste into their work",
        "- NEVER say 'You could write...' or 'Something like...' followed by a description",
        "- If you feel the urge to describe something vividly, stop.",
        "  Ask a question about it instead.",
        "- Respond in clear, analytical language — consultant, not storyteller",
        "",
    ]


def _story_header(story: dict) -> list[str]:
    lines = [f"## Story: {story['title']}"]
    if story.get("genre"): lines.append(f"Genre: {story['genre']}")
    if story.get("tone"): lines.append(f"Tone: {story['tone']}")
    if story.get("themes"): lines.append(f"Themes: {', '.join(story['themes'])}")
    if story.get("narrative_intent"): lines.append(f"Author's intent: {story['narrative_intent']}")
    lines.append("")
    return lines


def _systems_section(systems: list[dict]) -> list[str]:
    if not systems:
        return []
    lines = ["## World Systems"]
    for s in systems:
        lines.append(f"\n### {s['name']} ({s.get('type', 'system')})")
        if s.get("rules"): lines.append(f"Rules: {s['rules'][:400]}")
        if s.get("limitations"): lines.append(f"Limitations: {s['limitations'][:300]}")
        if s.get("costs"): lines.append(f"Costs: {s['costs'][:200]}")
    lines.append("")
    return lines


def build_location_existence_prompt(location_ctx: dict) -> str:
    """
    'What Would Exist Here?' prompt.

    Helps the author think through what would logically be present at this
    location based on its established properties and the world's rules.
    """
    story = location_ctx["story"]
    loc = location_ctx["location"]
    parent_chain = location_ctx.get("parent_chain", [])
    children = location_ctx.get("children", [])
    systems = location_ctx.get("world_systems", [])
    cultures = location_ctx.get("cultures", [])
    events = location_ctx.get("historical_events", [])

    lines = [
        "You are a world building consultant helping an author think through what would",
        "logically exist at a specific location. You surface implications, ask questions,",
        "and prompt deeper thinking — you do NOT describe or invent content for the author.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    # Location profile
    lines.append(f"## Location: {loc['name']}")
    if loc.get("type"): lines.append(f"Type: {loc['type']}")
    if parent_chain:
        chain = " → ".join(p["name"] for p in parent_chain)
        lines.append(f"Located within: {chain}")
    if loc.get("climate"): lines.append(f"Climate: {loc['climate']}")
    if loc.get("terrain"): lines.append(f"Terrain: {loc['terrain']}")
    if loc.get("political_affiliation"): lines.append(f"Political: {loc['political_affiliation']}")
    if loc.get("description"): lines.append(f"Description: {loc['description'][:500]}")
    if loc.get("atmosphere"): lines.append(f"Atmosphere: {loc['atmosphere'][:300]}")
    if loc.get("history"): lines.append(f"Local history: {loc['history'][:300]}")
    if loc.get("significance"): lines.append(f"Significance: {loc['significance'][:200]}")
    celestial = loc.get("celestial", {})
    if celestial:
        for k, v in celestial.items():
            if v: lines.append(f"{k.replace('_', ' ').title()}: {v}")
    if children:
        lines.append(f"Known sub-locations: {', '.join(c['name'] for c in children[:6])}")
    lines.append("")

    lines += _systems_section(systems)

    if cultures:
        lines += ["## Cultures in This World"]
        for c in cultures[:4]:
            parts = [c["name"]]
            if c.get("government_type"): parts.append(c["government_type"])
            lines.append(f"- {' — '.join(parts)}")
        lines.append("")

    if events:
        lines += ["## Historical Context"]
        for ev in events[:4]:
            lines.append(f"- {ev['name']}: {(ev.get('legacy_effects') or ev.get('description', ''))[:200]}")
        lines.append("")

    lines += [
        "---",
        "## YOUR TASK",
        f"Help the author think through what would logically exist at {loc['name']}.",
        "Use the established properties above as constraints, not suggestions.",
        "",
        "Respond with a JSON object matching this exact schema:",
        '{',
        '  "built_environment": ["consideration or question about structures/buildings/infrastructure"],',
        '  "natural_environment": ["consideration or question about flora/fauna/weather/terrain features"],',
        '  "cultural_presence": ["consideration or question about how cultures/people have shaped this place"],',
        '  "questions": ["specific question for the author to think through"]',
        '}',
        "",
        "Rules for each array:",
        "- built_environment: 3-5 items about structures, roads, buildings implied by terrain/climate/politics",
        "- natural_environment: 3-5 items about plants, animals, weather implied by climate/terrain",
        "- cultural_presence: 2-4 items about cultural marks, language, customs, settlements",
        "- questions: 3-5 specific questions rooted in the world data above",
        "Each item should be a short analytical statement or direct question (not prose).",
    ]

    return "\n".join(lines)


def build_element_suggestion_prompt(element: dict, element_type: str, world_ctx: dict) -> str:
    """
    Element brainstorming prompt for locations or cultures.

    Helps the author think through directions for names, customs, creatures,
    and other cultural/geographic elements.
    """
    story = world_ctx["story"]
    systems = world_ctx.get("world_systems", [])

    lines = [
        "You are a world building brainstorming partner helping an author think through",
        "the elements that could flesh out their world. You help them explore directions",
        "and ask questions — you do NOT invent names, customs, or descriptions for them.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    if element_type == "culture":
        c = element
        lines.append(f"## Culture: {c['name']}")
        if c.get("description"): lines.append(f"Description: {c['description'][:400]}")
        if c.get("values"): lines.append(f"Core values: {c['values'][:300]}")
        if c.get("customs"): lines.append(f"Customs: {c['customs'][:300]}")
        if c.get("taboos"): lines.append(f"Taboos: {c['taboos'][:300]}")
        if c.get("religion"): lines.append(f"Religion: {c['religion'][:300]}")
        if c.get("government_type"): lines.append(f"Government: {c['government_type']}")
        if c.get("economy"): lines.append(f"Economy: {c['economy'][:200]}")
        if c.get("social_hierarchy"): lines.append(f"Social structure: {c['social_hierarchy'][:200]}")
        nc = c.get("naming_conventions") or {}
        if nc:
            lines.append(f"Naming conventions (established): {nc}")
        cp = c.get("common_phrases") or []
        if cp:
            lines.append(f"Common phrases (established): {[p.get('phrase') for p in cp[:3]]}")
        lines.append("")

        lines += _systems_section(systems)

        lines += [
            "---",
            "## YOUR TASK",
            f"Help the author brainstorm directions for fleshing out the {c['name']} culture.",
            "Root every suggestion in the specific values, customs, and taboos above.",
            "",
            "Respond with a JSON object matching this exact schema:",
            '{',
            '  "naming_directions": ["direction or question about naming patterns, linguistic considerations"],',
            '  "ritual_directions": ["direction or question about rituals, customs, observances"],',
            '  "aesthetic_directions": ["direction or question about art, clothing, food, architecture"],',
            '  "questions": ["specific question for the author to think through"]',
            '}',
            "",
            "Rules for each array:",
            "- naming_directions: 3-4 items rooted in culture's values and taboos",
            "- ritual_directions: 3-4 items about ceremonies, traditions, observances",
            "- aesthetic_directions: 3-4 items about material culture shaped by the world system constraints",
            "- questions: 4-5 specific questions to deepen the culture's internal logic",
            "Each item is a short analytical direction or direct question (not a description).",
        ]

    else:  # location
        loc = element
        lines.append(f"## Location: {loc['name']}")
        if loc.get("type"): lines.append(f"Type: {loc['type']}")
        if loc.get("climate"): lines.append(f"Climate: {loc['climate']}")
        if loc.get("terrain"): lines.append(f"Terrain: {loc['terrain']}")
        if loc.get("description"): lines.append(f"Description: {loc['description'][:400]}")
        lines.append("")

        lines += _systems_section(systems)

        if world_ctx.get("cultures"):
            lines += ["## Cultures"]
            for c in world_ctx["cultures"][:3]:
                lines.append(f"- {c['name']}: {c.get('values', '')[:100]}")
            lines.append("")

        lines += [
            "---",
            "## YOUR TASK",
            f"Help the author brainstorm what kinds of elements would fit {loc['name']}.",
            "",
            "Respond with a JSON object matching this exact schema:",
            '{',
            '  "creature_directions": ["direction or question about creatures/wildlife"],',
            '  "flora_directions": ["direction or question about plant life/environment"],',
            '  "naming_directions": ["direction or question about naming patterns for this location"],',
            '  "questions": ["specific question for the author to think through"]',
            '}',
            "",
            "Rules for each array:",
            "- creature_directions: 3-4 items about ecological niches implied by terrain/climate",
            "- flora_directions: 3-4 items about plant life, fungi, environmental features",
            "- naming_directions: 3-4 items about naming patterns fitting character/culture/history",
            "- questions: 4-5 specific questions to flesh out the location's ecosystem",
            "Each item is a short analytical direction or direct question (not a description).",
        ]

    return "\n".join(lines)


def build_historical_implication_prompt(event_ctx: dict) -> str:
    """
    Historical Implication Analysis prompt.

    Helps the author think through what ripple effects of a historical event
    would be visible in the present day of their story.
    """
    story = event_ctx["story"]
    event = event_ctx["event"]
    era = event_ctx.get("era")
    era_events = event_ctx.get("era_events", [])
    cultures = event_ctx.get("cultures", [])
    systems = event_ctx.get("world_systems", [])

    lines = [
        "You are a world building consultant helping an author think through the present-day",
        "ripple effects of a historical event. You surface implications and ask questions",
        "— you do NOT write what these effects look like in prose.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    lines.append(f"## Historical Event: {event['name']}")
    if event.get("in_world_date"): lines.append(f"Date: {event['in_world_date']}")
    if era: lines.append(f"Era: {era['name']} ({era.get('start_date', '')} – {era.get('end_date', '')})")
    if event.get("description"): lines.append(f"Description: {event['description'][:500]}")
    if event.get("causes"): lines.append(f"Causes: {event['causes'][:300]}")
    if event.get("consequences"): lines.append(f"Consequences (recorded): {event['consequences'][:300]}")
    if event.get("legacy_effects"): lines.append(f"Legacy effects (noted): {event['legacy_effects'][:300]}")
    if event.get("participants"):
        participant_names = [p.get("name", "") for p in event["participants"] if p.get("name")]
        if participant_names:
            lines.append(f"Participants: {', '.join(participant_names[:6])}")
    lines.append("")

    if era and era.get("characteristics"):
        lines += [f"## Era: {era['name']}", f"Characteristics: {era['characteristics'][:300]}", ""]

    if era_events:
        lines += ["## Other Events in This Era"]
        for e in era_events[:4]:
            lines.append(f"- {e['name']}: {e.get('description', '')[:150]}")
        lines.append("")

    if cultures:
        lines += ["## Cultures in This World"]
        for c in cultures[:4]:
            parts = [c["name"]]
            if c.get("values"): parts.append(c["values"][:100])
            lines.append(f"- {' — '.join(parts)}")
        lines.append("")

    if systems:
        lines += ["## World Systems (for context)"]
        for s in systems[:3]:
            lines.append(f"- {s['name']} ({s.get('type', 'system')}): {s.get('rules', '')[:150]}")
        lines.append("")

    lines += [
        "---",
        "## YOUR TASK",
        f"Help the author think through what present-day traces of '{event['name']}' would exist.",
        "Surface questions and implications — do not write the story for them.",
        "",
        "Respond with a JSON object matching this exact schema:",
        '{',
        '  "physical_remnants": ["consideration about ruins, monuments, altered geography, or artifacts"],',
        '  "cultural_legacy": ["consideration about traditions, taboos, beliefs, or sayings that emerged"],',
        '  "political_effects": ["consideration about alliances, rivalries, borders, or power structures"],',
        '  "questions": ["specific question for the author to think through"]',
        '}',
        "",
        "Rules for each array:",
        "- physical_remnants: 3-4 items about tangible traces (ask questions, don't describe them)",
        "- cultural_legacy: 3-4 items rooted in the specific cultures from world context",
        "- political_effects: 2-3 items about power dynamics still relevant to the story",
        "- questions: 4-5 specific questions connecting this history to the current story",
        "Each item is a short analytical statement or direct question (not prose).",
    ]

    return "\n".join(lines)


def build_system_analysis_prompt(system_ctx: dict) -> str:
    """
    World System Analysis prompt.

    Helps the author think through the edge cases, story implications,
    and potential consistency issues in a defined world system.
    """
    story = system_ctx["story"]
    system = system_ctx["system"]
    other_systems = system_ctx.get("other_systems", [])
    cultures = system_ctx.get("cultures", [])

    lines = [
        "You are a world building consultant helping an author stress-test a world system.",
        "You surface logical edge cases, story implications, and consistency questions",
        "— you do NOT write rules or limitations for the author.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    lines.append(f"## System: {system['name']} ({system.get('type', 'system')})")
    if system.get("source_origin"): lines.append(f"Source/Origin: {system['source_origin'][:300]}")
    if system.get("rules"): lines.append(f"Rules: {system['rules'][:500]}")
    if system.get("limitations"): lines.append(f"Limitations: {system['limitations'][:400]}")
    if system.get("costs"): lines.append(f"Costs: {system['costs'][:300]}")
    if system.get("tiers"):
        tier_names = [t.get("name", "") for t in system["tiers"][:5] if t.get("name")]
        if tier_names:
            lines.append(f"Hierarchy tiers: {' → '.join(tier_names)}")
    if system.get("notes"): lines.append(f"Notes: {system['notes'][:300]}")
    lines.append("")

    if other_systems:
        lines += ["## Other Systems in This World"]
        for s in other_systems[:3]:
            lines.append(f"- {s['name']} ({s.get('type', 'system')}): {s.get('rules', '')[:150]}")
        lines.append("")

    if cultures:
        lines += ["## Cultures That Interact With This System"]
        for c in cultures[:3]:
            parts = [c["name"]]
            if c.get("government_type"): parts.append(c["government_type"])
            lines.append(f"- {' — '.join(parts)}")
        lines.append("")

    lines += [
        "---",
        "## YOUR TASK",
        f"Help the author stress-test the '{system['name']}' system.",
        "Surface what they may not have thought through.",
        "",
        "Respond with a JSON object matching this exact schema:",
        '{',
        '  "edge_cases": ["scenario or situation the current rules do not clearly address"],',
        '  "story_implications": ["consideration about how this system shapes character choices or plot"],',
        '  "consistency_questions": ["potential contradiction or gap between this system and other world elements"],',
        '  "questions": ["specific question for the author to think through"]',
        '}',
        "",
        "Rules for each array:",
        "- edge_cases: 3-5 specific scenarios the rules may not cover (e.g., 'What happens when...')",
        "- story_implications: 3-4 items about how the system creates or limits narrative possibilities",
        "- consistency_questions: 2-3 potential gaps or conflicts with other established systems/cultures",
        "- questions: 3-4 questions to sharpen the system's internal logic",
        "Each item is a short analytical statement or direct question (not prose).",
    ]

    return "\n".join(lines)


def build_calendar_suggestion_prompt(calendar_ctx: dict) -> str:
    """
    Calendar Suggestions prompt.

    Helps the author think through what festivals, seasonal events, and historical
    observances would logically exist in this calendar system.
    """
    story = calendar_ctx["story"]
    calendar = calendar_ctx["calendar"]
    cultures = calendar_ctx.get("cultures", [])
    events = calendar_ctx.get("historical_events", [])

    lines = [
        "You are a world building consultant helping an author think through what significant",
        "days would exist in this calendar system. You surface directions and questions",
        "— you do NOT name or describe the holidays for the author.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    lines.append(f"## Calendar: {calendar['name']}")
    if calendar.get("epoch_name"): lines.append(f"Epoch: {calendar['epoch_name']}")
    if calendar.get("description"): lines.append(f"Description: {calendar['description'][:300]}")
    months = calendar.get("months", [])
    if months:
        month_names = [m.get("name", f"Month {i+1}") for i, m in enumerate(months[:12])]
        lines.append(f"Months ({len(months)}): {', '.join(month_names)}")
    if calendar.get("days_per_week"):
        lines.append(f"Days per week: {calendar['days_per_week']}")
    week_days = calendar.get("week_day_names", [])
    if week_days:
        lines.append(f"Weekday names: {', '.join(week_days[:7])}")
    existing_special = calendar.get("special_days", [])
    if existing_special:
        existing_names = [s.get("name", "") for s in existing_special[:5] if s.get("name")]
        lines.append(f"Existing special days: {', '.join(existing_names)}")
    lines.append("")

    if cultures:
        lines += ["## Cultures Using This Calendar"]
        for c in cultures[:4]:
            parts = [c["name"]]
            if c.get("religion"): parts.append(f"religion: {c['religion'][:80]}")
            if c.get("values"): parts.append(f"values: {c['values'][:80]}")
            lines.append(f"- {' — '.join(parts)}")
        lines.append("")

    if events:
        lines += ["## Historical Events (potential observances)"]
        for ev in events[:5]:
            lines.append(f"- {ev['name']}: {ev.get('description', '')[:150]}")
        lines.append("")

    lines += [
        "---",
        "## YOUR TASK",
        f"Help the author think through what special days would exist in '{calendar['name']}'.",
        "Root suggestions in the specific cultures and historical events above.",
        "",
        "Respond with a JSON object matching this exact schema:",
        '{',
        '  "festivals": ["direction or question about a celebration or festival"],',
        '  "seasonal_events": ["direction or question about seasonal/agricultural/astronomical observances"],',
        '  "historical_observances": ["direction or question about commemorating specific historical events"],',
        '  "questions": ["specific question for the author to think through"]',
        '}',
        "",
        "Rules for each array:",
        "- festivals: 3-5 items rooted in cultural values, religions, and social structures",
        "- seasonal_events: 2-4 items tied to the calendar's month/day structure",
        "- historical_observances: 2-3 items commemorating specific events from the world's history",
        "- questions: 3-4 questions about what these observances mean for the cultures",
        "Each item is a short direction or question (not a name or description of the holiday).",
    ]

    return "\n".join(lines)


def build_travel_analysis_prompt(travel_ctx: dict) -> str:
    """
    Travel Route Analysis prompt.

    Helps the author think through the journey between two locations —
    considerations, hazards, and narrative possibilities.
    """
    story = travel_ctx["story"]
    from_loc = travel_ctx["from_location"]
    to_loc = travel_ctx["to_location"]
    travel = travel_ctx.get("travel", {})
    systems = travel_ctx.get("world_systems", [])

    lines = [
        "You are a world building consultant helping an author think through a journey",
        "between two locations. You surface considerations, hazards, and questions",
        "— you do NOT write travel sequences or descriptions for the author.",
        "",
    ]
    lines += _anti_prose_rules()
    lines += _story_header(story)

    lines.append(f"## Route: {from_loc['name']} → {to_loc['name']}")
    if travel.get("travel_time"): lines.append(f"Established travel time: {travel['travel_time']}")
    if travel.get("travel_method"): lines.append(f"Method: {travel['travel_method']}")
    if travel.get("condition"): lines.append(f"Condition: {travel['condition']}")
    if travel.get("notes"): lines.append(f"Notes: {travel['notes'][:200]}")
    lines.append("")

    lines.append(f"## Origin: {from_loc['name']}")
    if from_loc.get("type"): lines.append(f"Type: {from_loc['type']}")
    if from_loc.get("climate"): lines.append(f"Climate: {from_loc['climate']}")
    if from_loc.get("terrain"): lines.append(f"Terrain: {from_loc['terrain']}")
    if from_loc.get("political_affiliation"): lines.append(f"Political: {from_loc['political_affiliation']}")
    lines.append("")

    lines.append(f"## Destination: {to_loc['name']}")
    if to_loc.get("type"): lines.append(f"Type: {to_loc['type']}")
    if to_loc.get("climate"): lines.append(f"Climate: {to_loc['climate']}")
    if to_loc.get("terrain"): lines.append(f"Terrain: {to_loc['terrain']}")
    if to_loc.get("political_affiliation"): lines.append(f"Political: {to_loc['political_affiliation']}")
    lines.append("")

    lines += _systems_section(systems)

    lines += [
        "---",
        "## YOUR TASK",
        f"Help the author think through the journey from {from_loc['name']} to {to_loc['name']}.",
        "",
        "Respond with a JSON object matching this exact schema:",
        '{',
        '  "journey_considerations": ["consideration about logistics, terrain, or resources for this route"],',
        '  "hazards_and_challenges": ["potential hazard, obstacle, or complication for this route"],',
        '  "narrative_possibilities": ["story opportunity this journey creates — conflict, discovery, change"],',
        '  "questions": ["specific question for the author to think through"]',
        '}',
        "",
        "Rules for each array:",
        "- journey_considerations: 3-4 items about logistics, climate, terrain transitions, political borders",
        "- hazards_and_challenges: 3-4 items about dangers, complications, or obstacles",
        "- narrative_possibilities: 3-4 items about story opportunities this route creates",
        "- questions: 3-4 questions to help the author make the most of this journey",
        "Each item is a short analytical statement or question (not prose or a travel description).",
    ]

    return "\n".join(lines)
