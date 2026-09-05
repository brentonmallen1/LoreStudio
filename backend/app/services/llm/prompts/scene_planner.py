"""
Scene Planner prompt — helps authors plan a scene before writing it.

Distinct from the What's Next? brainstormer (which helps during/after writing):
- Scene Planner is about structural planning BEFORE prose
- Output maps directly to the scene's Notes fields: synopsis, purpose,
  entry_state, exit_state, key_events
- Also suggests characters to feature and threads to advance
- Never generates prose — only structural planning content
"""


def build_scene_planner_system_prompt(ctx: dict, initial_notes: str | None = None) -> str:
    """
    Build the system prompt for the Scene Planner feature.

    Args:
        ctx: Context packet from _build_context_packet
        initial_notes: Optional free-text from the author about what they already know
    """
    s = ctx["story"]
    sc = ctx["scene"]

    lines = [
        "You are a story structure consultant helping an author plan a scene before they write it.",
        "Your job is to suggest concrete, specific content for each of the scene's planning fields.",
        "",
        "## YOUR ROLE",
        "- Analyze the story's current state and suggest what this scene could accomplish",
        "- Propose specific text for each planning field: synopsis, purpose, entry state, exit state, key events",
        "- Suggest which characters to feature and which plot threads to advance",
        "- Root every suggestion in the story's actual characters, threads, and authorial intent",
        "",
        "## ABSOLUTE RULES",
        "- NEVER write prose, dialogue, or narrative text",
        "- Suggestions for planning fields should be analytical and concise — author notes, not story content",
        "- If you offer multiple options for a field, keep each to 1-2 sentences",
        "- Do not pad. Be specific. Use the actual character names, thread names, and story elements.",
        "",
    ]

    # ── Story context ──
    lines.append(f"## Story: {s['title']}")
    if s.get("genre"):
        lines.append(f"Genre: {s['genre']}")
    if s.get("tone"):
        lines.append(f"Tone: {s['tone']}")
    if s.get("themes"):
        lines.append(f"Themes: {', '.join(s['themes'])}")
    if s.get("central_conflict"):
        lines.append(f"Central conflict: {s['central_conflict']}")
    if s.get("narrative_intent"):
        lines.append(f"Author's intent: {s['narrative_intent']}")
    if s.get("logline"):
        lines.append(f"Logline: {s['logline']}")
    if s.get("unresolved_goals"):
        lines.append(f"Unresolved story goals: {'; '.join(s['unresolved_goals'])}")

    # ── This scene ──
    lines += ["", f'## Scene to plan: "{sc["title"]}" ({sc.get("level_type", "scene")})']
    if sc.get("word_count", 0) > 0:
        lines.append(f"(Already has {sc['word_count']} words written)")
    if sc.get("synopsis"):
        lines.append(f"Current synopsis: {sc['synopsis']}")
    if sc.get("purpose"):
        lines.append(f"Current purpose note: {sc['purpose']}")
    if sc.get("entry_state"):
        lines.append(f"Current entry state: {sc['entry_state']}")
    if sc.get("exit_state"):
        lines.append(f"Current exit state: {sc['exit_state']}")
    if sc.get("key_events"):
        lines.append(f"Current key events: {sc['key_events']}")

    # ── Characters ──
    if ctx["characters_in_scene"]:
        lines += ["", "## Characters already in this scene"]
        for c in ctx["characters_in_scene"]:
            lines.append(f"\n### {c['name']} ({c.get('role', '')})")
            if c.get("personality"):
                lines.append(f"Personality: {c['personality']}")
            if c.get("motivation"):
                lines.append(f"Motivation: {c['motivation']}")
            if c.get("arc_notes"):
                lines.append(f"Arc: {c['arc_notes']}")
            if c.get("narrative_intent"):
                lines.append(f"Author's plan: {c['narrative_intent']}")
            if c.get("arc_milestones_pending"):
                lines.append(f"Pending milestones: {'; '.join(c['arc_milestones_pending'])}")
    if ctx["all_characters"]:
        lines += ["", "## All story characters"]
        for c in ctx["all_characters"]:
            line = f"- {c['name']} ({c['role']})"
            if c.get("motivation"):
                line += f": {c['motivation'][:80]}"
            lines.append(line)

    # ── Plot threads ──
    if ctx["threads_in_scene"]:
        lines += ["", "## Threads already tagged to this scene"]
        for t in ctx["threads_in_scene"]:
            line = f"- {t['name']} [{t['status']}]"
            if t.get("description"):
                line += f": {t['description']}"
            lines.append(line)
    if ctx["open_threads"]:
        open_threads_not_in_scene = [
            t for t in ctx["open_threads"] if not any(t["name"] == ts["name"] for ts in ctx["threads_in_scene"])
        ]
        if open_threads_not_in_scene:
            lines += ["", "## Other open threads in this story"]
            for t in open_threads_not_in_scene:
                lines.append(f"- {t['name']} [{t['status']}]")

    # ── Adjacent scenes for structural awareness ──
    if ctx["sibling_scenes"]:
        lines += ["", "## Other scenes in this section (for structural awareness)"]
        for sib in ctx["sibling_scenes"]:
            line = f"- {sib['title']}"
            if sib.get("synopsis"):
                line += f": {sib['synopsis']}"
            lines.append(line)

    # ── Author's initial notes ──
    if initial_notes:
        lines += ["", "## What the author already knows about this scene", initial_notes]

    # ── Output format ──
    lines += [
        "",
        "---",
        "## OUTPUT FORMAT",
        "",
        "Respond with a JSON object matching this exact schema:",
        "",
        "{",
        '  "synopsis": "1-2 sentences describing what happens — author shorthand, not prose",',
        '  "purpose": "Why this scene must exist. What narrative function does it serve?",',
        '  "entry_state": "The situation at the start: beliefs, tensions, physical state, stakes",',
        '  "exit_state": "What changed by the end: what shifted, gained, lost, set in motion",',
        '  "key_events": ["pivotal moment 1", "pivotal moment 2", "..."],',
        '  "characters_to_feature": [{"name": "character name", "reason": "why and how they serve the scene"}],',
        '  "threads_to_advance": [{"name": "thread name", "how": "specifically how this scene develops it"}]',
        "}",
        "",
        "Rules:",
        "- Output ONLY valid JSON. No markdown, no extra text before or after.",
        "- key_events: 2-4 items, each a specific concrete moment (not vague).",
        "- characters_to_feature: Only include characters who genuinely serve this scene.",
        "- threads_to_advance: Only threads that this scene could meaningfully develop.",
        "- If any field already has content, keep your suggestion compatible with it or refine it.",
        "- Be specific and use actual names from the story context above.",
    ]

    return "\n".join(lines)
