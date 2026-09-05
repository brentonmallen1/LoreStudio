"""
Twist & Misdirection analysis prompts.
"""

from ....models.twist import Twist


def build_twist_analysis_prompt(
    twist: Twist,
    clue_scenes: list[dict],  # [{clue_id, clue_text, points_to, subtlety, scene_title, scene_content}]
    reveal_scene: dict | None,  # {title, content}
    story_title: str,
    all_scenes: list[dict] | None = None,  # [{id, title}] for suggesting scene links
) -> str:
    clue_lines = []
    for c in clue_scenes:
        direction = "→ TRUTH" if c["points_to"] == "truth" else "→ MISDIRECTION"
        scene_ref = f"[{c['scene_title']}]" if c.get("scene_title") else "[scene not linked]"
        excerpt = ""
        if c.get("scene_content"):
            # Include a truncated excerpt of the scene for context
            excerpt = f"\n    Scene excerpt: {c['scene_content'][:600]}{'...' if len(c.get('scene_content', '')) > 600 else ''}"
        clue_lines.append(f'  - Clue ({c["subtlety"]}, {direction}) {scene_ref}: "{c["clue_text"]}"{excerpt}')

    clues_block = "\n".join(clue_lines) if clue_lines else "  (no clues defined)"

    reveal_block = ""
    if reveal_scene:
        excerpt = reveal_scene.get("content", "")[:800]
        reveal_block = f"\nREVEAL SCENE: {reveal_scene['title']}\n{excerpt}{'...' if len(reveal_scene.get('content', '')) > 800 else ''}"
    else:
        reveal_block = "\nREVEAL SCENE: not yet assigned"

    # Build all-scenes reference block for unlinked clue suggestions
    scenes_ref_block = ""
    if all_scenes:
        lines = [f'  - id: "{s["id"]}" title: "{s["title"]}"' for s in all_scenes]
        scenes_ref_block = "\nALL STORY SCENES (for suggesting links):\n" + "\n".join(lines) + "\n"

    return f"""You are a story craft advisor analyzing a twist in "{story_title}".

TWIST: {twist.name}
Type: {twist.twist_type}
Status: {twist.status}

THE TRUTH (what's actually happening):
{twist.the_truth or "(not defined)"}

THE MISDIRECTION (what readers are led to believe):
{twist.the_misdirection or "(not defined)"}

PLANTED CLUES ({len(clue_scenes)} defined):
{clues_block}
{reveal_block}{scenes_ref_block}

Analyze this twist and respond with a JSON object matching this exact schema:

{{
  "clue_verification": {{
    "summary": "1-2 sentence overview of clue quality and coverage",
    "details": [
      {{
        "clue_id": "the clue_id from the planted clues data above (empty string if unknown)",
        "clue_text": "the clue text",
        "assessment": "found/missing/needs-work",
        "notes": "specific observation about this clue",
        "suggested_scene_id": "scene id from ALL STORY SCENES where this clue likely belongs (only for missing/unlinked clues, otherwise empty string)",
        "suggested_scene_title": "matching title from ALL STORY SCENES (only for missing/unlinked clues, otherwise empty string)"
      }}
    ]
  }},
  "distribution": {{
    "summary": "Assessment of clue distribution across the story timeline and balance between truth/misdirection clues",
    "gaps": ["description of any gap between clues or before reveal"],
    "truth_count": 0,
    "misdirection_count": 0
  }},
  "reveal": {{
    "summary": "Assessment of the reveal scene's effectiveness and payoff",
    "unforeshadowed_elements": ["any element introduced at reveal not set up earlier"],
    "strengths": ["what works well about the reveal"]
  }},
  "misdirection_strength": {{
    "summary": "How effectively the misdirection misleads readers",
    "suggestions": ["ways to strengthen or reinforce the false trail"]
  }},
  "overall_rating": "needs_work | fair | good | excellent",
  "suggestions": [
    "specific, actionable suggestion 1",
    "specific, actionable suggestion 2"
  ]
}}

Be specific and reference the actual content. Focus on craft: fairness (could a careful reader have figured this out?), payoff (does the reveal feel earned?), and balance (are truth and misdirection clues well-distributed?).
"""
