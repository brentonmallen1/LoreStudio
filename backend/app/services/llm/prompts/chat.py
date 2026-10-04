"""
Chat prompts — scene-aware chat assistant and writing coach.
"""

from ...codex.mentions import render_mentions
from ...series.promises import render_earlier


def build_writing_coach_system_prompt(ctx: dict) -> str:
    """
    Build the system prompt for the writing coach mode.
    Same scene context as the chat assistant, but framed as a prose coaching session.
    """
    s = ctx["story"]
    sc = ctx.get("scene")

    lines = [
        "You are a writing coach embedded in LoreStudio, helping an author think through their prose choices.",
        "",
        "Your role is NOT to rewrite for the author. You help them think clearly about their own work.",
        "When given a passage to review:",
        "1. Briefly note what is working well in the selection.",
        "2. Raise one or two considerations or trade-offs the author might weigh.",
        "3. Offer 2-3 concrete alternative directions with brief reasoning — explain the *why*, not just the text.",
        "Never prescribe. Always frame suggestions as options for the author to consider.",
        "Keep responses focused and conversational — this is a dialogue, not a critique.",
        "",
        f"## Story: {s['title']}",
    ]
    if s.get("genre"):
        lines.append(f"Genre: {s['genre']}")
    if s.get("tone"):
        lines.append(f"Tone: {s['tone']}")
    if s.get("themes"):
        lines.append(f"Themes: {', '.join(s['themes'])}")
    if s.get("narrative_intent"):
        lines.append(f"Author's intent: {s['narrative_intent']}")
    if s.get("narrative_perspective"):
        pov_line = f"Narrative perspective: {s['narrative_perspective'].replace('_', ' ').title()}"
        if s.get("pov_character"):
            pov_line += f" (POV: {s['pov_character']})"
        lines.append(pov_line)

    if sc:
        lines += ["", f"## Current scene: {sc['title']} ({sc.get('level_type', 'scene')})"]
        if sc.get("synopsis"):
            lines.append(f"Synopsis: {sc['synopsis']}")
        if sc.get("purpose"):
            lines.append(f"Purpose: {sc['purpose']}")

    if ctx["characters_in_scene"]:
        lines += ["", "## Characters in this scene"]
        for c in ctx["characters_in_scene"]:
            line = f"- {c['name']}"
            if c.get("personality"):
                line += f": {c['personality']}"
            lines.append(line)
    elif ctx["all_characters"]:
        lines += ["", "## Story characters"]
        for c in ctx["all_characters"]:
            lines.append(f"- {c['name']} ({c['role']})")

    lines.append(render_mentions(ctx.get("mentioned")))

    lines += [
        "",
        "---",
        "Remember: the author does the writing. You illuminate choices.",
    ]
    return "\n".join(lines)


def build_scene_chat_system_prompt(ctx: dict) -> str:  # noqa: C901, PLR0912, PLR0915
    """
    Build the system prompt for the scene-aware chat assistant.
    Assembles context from the story lorebook, active scene, characters, threads, etc.
    """
    s = ctx["story"]
    sc = ctx.get("scene")

    lines = [
        "You are a creative writing assistant embedded in LoreStudio, helping an author with their story.",
        "",
        f"## Story: {s['title']}",
    ]
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
    if s.get("narrative_perspective"):
        pov_line = f"Narrative perspective: {s['narrative_perspective'].replace('_', ' ').title()}"
        if s.get("pov_character"):
            pov_line += f" (POV: {s['pov_character']})"
        lines.append(pov_line)
    if s.get("unresolved_goals"):
        lines.append(f"Unresolved story goals: {'; '.join(s['unresolved_goals'])}")

    if sc:
        lines += ["", f"## Current scene: {sc['title']} ({sc.get('level_type', 'scene')})"]
        if sc.get("synopsis"):
            lines.append(f"Synopsis: {sc['synopsis']}")
        if sc.get("purpose"):
            lines.append(f"Purpose: {sc['purpose']}")
        if sc.get("entry_state"):
            lines.append(f"Entry state: {sc['entry_state']}")
        if sc.get("exit_state"):
            lines.append(f"Exit state (goal): {sc['exit_state']}")
        if sc.get("key_events"):
            lines.append(f"Key events planned: {sc['key_events']}")
        if sc.get("prose_preview"):
            lines += ["", "Prose so far (excerpt):", sc["prose_preview"]]

    if ctx["characters_in_scene"]:
        lines += ["", "## Characters in this scene"]
        for c in ctx["characters_in_scene"]:
            lines.append(f"\n### {c['name']} ({c.get('role', '')})")
            if c.get("personality"):
                lines.append(f"Personality: {c['personality']}")
            if c.get("motivation"):
                lines.append(f"Motivation: {c['motivation']}")
            if c.get("arc_notes"):
                lines.append(f"Arc: {c['arc_notes']}")
            if c.get("narrative_intent"):
                lines.append(f"Author's plan for this character: {c['narrative_intent']}")
            if c.get("arc_milestones_pending"):
                lines.append(f"Pending arc milestones: {'; '.join(c['arc_milestones_pending'])}")
    elif ctx["all_characters"]:
        lines += ["", "## Story characters (all)"]
        for c in ctx["all_characters"]:
            line = f"- {c['name']} ({c['role']})"
            if c.get("motivation"):
                line += f": {c['motivation']}"
            lines.append(line)

    if ctx["settings_in_scene"]:
        lines += ["", "## Settings in this scene"]
        for setting in ctx["settings_in_scene"]:
            lines.append(f"\n### {setting['name']}")
            if setting.get("description"):
                lines.append(setting["description"])
            if setting.get("atmosphere"):
                lines.append(f"Atmosphere: {setting['atmosphere']}")

    if ctx["threads_in_scene"]:
        lines += ["", "## Plot threads active in this scene"]
        for t in ctx["threads_in_scene"]:
            line = f"- {t['name']} [{t['status']}]"
            if t.get("description"):
                line += f": {t['description']}"
            lines.append(line)
    if ctx["open_threads"]:
        open_names = [t["name"] for t in ctx["open_threads"] if t not in ctx["threads_in_scene"]]
        if open_names:
            lines.append(f"\nOther open threads in this story: {', '.join(open_names)}")

    lines += render_earlier(ctx.get("earlier_books"))

    if ctx["sibling_scenes"]:
        lines += ["", "## Other scenes in this section"]
        for sib in ctx["sibling_scenes"]:
            line = f"- {sib['title']}"
            if sib.get("synopsis"):
                line += f": {sib['synopsis']}"
            lines.append(line)

    if ctx.get("retrieved_passages"):
        # Each passage says why it is here. A model told that Mara was present in the
        # scene a passage comes from can weigh it as evidence; one handed unlabelled
        # prose can only imitate it.
        lines += ["", "## Passages from elsewhere in the story"]
        for passage in ctx["retrieved_passages"]:
            heading = f"\n### {passage['label']}"
            if passage.get("why"):
                heading += f" — {passage['why']}"
            lines += [heading, passage["text"]]

    lines.append(render_mentions(ctx.get("mentioned")))

    lines += [
        "",
        "---",
        "You are a thoughtful collaborator, not a content generator. Help the author think through "
        "their story — answer questions, brainstorm, identify problems, suggest directions, check "
        "consistency. You do not write prose for them, and that holds when they ask you to: say so "
        "plainly, then offer what actually helps — the question the passage is avoiding, or two or "
        "three one-line options they can write out themselves. Respond in the author's perspective, "
        "not the characters'. Keep responses focused and useful.",
    ]

    return "\n".join(lines)
