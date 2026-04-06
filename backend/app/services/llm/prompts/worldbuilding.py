"""
World building AI assistance prompts.

Three features, all following the "guide not co-author" philosophy:
- What Would Exist Here? — logical implications of a location's properties
- Element Suggestions — brainstorming directions for culture/geography elements
- Historical Implication Analysis — ripple effects of past events

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
        "Structure your response with these sections:",
        "**Built Environment:**",
        "What structures, buildings, or infrastructure would be implied by this location's",
        "type, climate, terrain, political situation, and history? Ask questions, don't describe.",
        "",
        "**Natural Environment:**",
        "What flora, fauna, weather patterns, or natural phenomena are implied?",
        "Reference terrain and climate specifically.",
        "",
        "**Cultural Presence:**",
        "How might resident or affiliated cultures have shaped or used this place?",
        "Reference specific cultures from the world context.",
        "",
        "**Questions to Consider:**",
        "3–5 specific questions the author should think through to make this location richer.",
        "Root each question in the specific established details above.",
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
            "Structure your response with these sections:",
            "**Naming Directions:**",
            "What patterns or linguistic considerations does this culture's values suggest?",
            "What questions should the author think through for given names, family names, titles?",
            "",
            "**Ritual & Custom Directions:**",
            "What kinds of rituals or customs would logically follow from their values and taboos?",
            "Ask questions — don't invent the rituals themselves.",
            "",
            "**Aesthetic & Material Directions:**",
            "What might their relationship to art, clothing, food, or architecture suggest?",
            "How do their world system constraints shape what's possible?",
            "",
            "**Questions to Consider:**",
            "4–5 specific questions that would help the author deepen this culture's internal logic.",
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
            "Structure your response with these sections:",
            "**Creature & Wildlife Directions:**",
            "What ecological niches are implied by this terrain and climate?",
            "What questions should the author think through?",
            "",
            "**Flora & Environment Directions:**",
            "What plant life, fungi, or environmental features are suggested by climate + terrain?",
            "",
            "**Naming Directions:**",
            "What naming patterns would fit this location's character, culture, and history?",
            "",
            "**Questions to Consider:**",
            "4–5 specific questions to help the author flesh out this location's ecosystem.",
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
        "Structure your response with these sections:",
        "**Physical Remnants:**",
        "What ruins, monuments, altered geography, or artifacts would this event have left?",
        "Ask questions — what should the author decide about the physical evidence?",
        "",
        "**Cultural Legacy:**",
        "How might this event live in the cultures' collective memory?",
        "What traditions, taboos, beliefs, or sayings might have emerged from it?",
        "Reference specific cultures from the world context.",
        "",
        "**Political & Power Implications:**",
        "What alliances, rivalries, borders, or power structures were shaped by this event?",
        "Which of those dynamics might still be relevant to your story?",
        "",
        "**Character Connections:**",
        "How might your characters' families or factions have been touched by this event?",
        "What inherited advantages, disadvantages, or attitudes might trace back to it?",
        "",
        "**Questions to Consider:**",
        "4–5 specific questions to help the author connect this history to their current story.",
    ]

    return "\n".join(lines)
