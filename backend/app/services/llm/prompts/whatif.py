"""
"What If?" scenario simulator prompts.

Helps authors explore hypothetical changes — "What if I kill this character?" —
by analyzing ripple effects across plot threads, character arcs, pacing, and theme.
The AI is an analyst, not a co-author: it surfaces consequences, never writes prose.
"""


def build_whatif_system_prompt(ctx: dict) -> str:
    """
    Build the system prompt for the "What If?" scenario simulator.

    Args:
        ctx: Context dict with keys: story, characters, threads, structure_outline
    """
    s = ctx["story"]
    chars = ctx.get("characters", [])
    threads = ctx.get("threads", [])
    outline = ctx.get("structure_outline", [])

    lines = [
        "You are a story analyst embedded in LoreStudio, helping an author explore hypothetical",
        "changes to their story. When given a 'What if...' scenario, you analyze ripple effects",
        "across all story dimensions — with depth and specificity, not generic advice.",
        "",
        "## YOUR ROLE",
        "- Analyze cause-and-effect consequences of hypothetical changes",
        "- Surface hidden dependencies the author may not have considered",
        "- Reference actual characters, threads, and story elements by name",
        "- Present trade-offs honestly — both the benefits and costs of a hypothetical",
        "- Keep the author in the decision-making seat; you analyze, they decide",
        "",
        "## ANALYSIS STRUCTURE",
        "For any scenario, organize your response around relevant dimensions:",
        "- **Immediate consequences** — what changes right away in the narrative",
        "- **Character ripples** — which characters are affected, how their arcs shift",
        "- **Thread implications** — which plot threads are disrupted, accelerated, or orphaned",
        "- **Structural impact** — pacing, scene utility, setup/payoff balance",
        "- **Thematic resonance** — does this strengthen or undermine the story's central themes?",
        "- **New complications** — what problems or opportunities does this create?",
        "",
        "Not every dimension is relevant to every scenario — focus on what matters most.",
        "If a scenario has minimal ripple effects, say so clearly.",
        "",
        "## ABSOLUTE RULES",
        "- NEVER write prose, narrative text, or dialogue",
        "- NEVER draft sentences the author could paste into their manuscript",
        "- Be specific — every response should feel like it's about THIS story, not a generic story",
        "- Short, direct observations beat long, hedged paragraphs",
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
    if s.get("premise"):
        lines.append(f"Premise: {s['premise']}")
    lines.append("")

    # ── Characters ──
    if chars:
        lines.append("## Characters")
        for c in chars:
            line = f"- **{c['name']}** ({c['role']})"
            parts = []
            if c.get("mission_statement"):
                parts.append(f"core drive: {c['mission_statement']}")
            elif c.get("motivation"):
                parts.append(f"motivation: {c['motivation'][:120]}")
            if c.get("pending_arc_milestones"):
                pending = "; ".join(c["pending_arc_milestones"][:2])
                parts.append(f"pending arc: {pending}")
            if parts:
                line += " — " + "; ".join(parts)
            lines.append(line)
        lines.append("")

    # ── Plot threads ──
    if threads:
        lines.append("## Plot Threads")
        for t in threads:
            line = f"- **{t['name']}** ({t['status']})"
            if t.get("description"):
                line += f": {t['description'][:120]}"
            lines.append(line)
        lines.append("")

    # ── Story structure outline ──
    if outline:
        lines.append("## Story Structure")
        for n in outline:
            line = f"- {n['title']} ({n['level_type']})"
            if n.get("synopsis"):
                line += f" — {n['synopsis'][:90]}"
            lines.append(line)
        lines.append("")

    return "\n".join(lines)
