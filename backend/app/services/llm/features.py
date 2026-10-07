"""
The AI feature table — one row per feature that can reach the LLM gateway.

Refactor doc 06 §1. Before this table the same feature was described in four places:
`FEATURE_LABELS` (21 of 59 features), the frontend `featureRegistry.ts` (40 entries,
several pointing at feature ids that never existed), Chronicle's own copy of the labels,
and nothing at all for the rest — which showed up in the activity log as raw ids.

This module is the source. `scripts/gen_ai_features.py` renders it into
`frontend/src/lib/ai/features.generated.ts`, so the panel, the palette, Chronicle and the
settings cards all read the same rows. `tests/services/test_ai_features.py` fails when a
router passes a `feature=` id that is not listed here.

Every AI feature is Studio-only: Writer mode renders no AI affordance at all
(CLAUDE.md), so there is no per-feature `modes` column to get out of step.
"""

from dataclasses import dataclass, field
from typing import Literal

# Where the feature lives in the AI panel. "system" features are internal calls
# (titling, compaction, batch summaries) — they are logged, but never listed as
# something the author starts.
FeatureGroup = Literal["talk", "cast", "analyse", "explore", "prepare", "system"]

# The co-author contract (doc 06 §5). The class decides what the model is allowed to
# hand back, and Stage 3's prompt audit holds each builder to it.
FeatureClass = Literal["reflect", "analyse", "option", "persona", "draft", "summarise"]

GROUP_LABELS: dict[str, str] = {
    "talk": "Talk",
    "cast": "Ask the cast",
    "analyse": "Analyse",
    "explore": "Explore",
    "prepare": "Prepare",
    "system": "Background",
}

CLASS_LABELS: dict[str, str] = {
    "reflect": "Reflects",
    "analyse": "Analyses",
    "option": "Offers options",
    "persona": "Speaks in character",
    "draft": "Drafts (not manuscript)",
    "summarise": "Summarises",
}

CLASS_DESCRIPTIONS: dict[str, str] = {
    "reflect": "Asks questions and points at your text. Never writes prose for you.",
    "analyse": "Returns structured findings about text you wrote.",
    "option": "Offers short labelled alternatives for you to rewrite in your own words.",
    "persona": "A character answers as themselves, within what they know.",
    "draft": "Drafts non-manuscript material (blurbs, queries, Lorebook fields) for you to edit.",
    "summarise": "Compresses your own text with nothing added.",
}

# Context budgets in tokens. The gateway sends this as `num_ctx`, capped by the model's
# own context length and the user's ceiling (doc 06 §4). Line-level work over a single
# scene needs little; whole-manuscript analyses need a lot.
BUDGET_SMALL = 8192
BUDGET_MEDIUM = 16384
BUDGET_LARGE = 32768


@dataclass(frozen=True)
class AIFeature:
    """One AI feature: what it is called, what it may return, and how much context it gets."""

    id: str
    label: str
    group: FeatureGroup
    classification: FeatureClass
    description: str
    context: tuple[str, ...] = field(default_factory=tuple)
    budget: int = BUDGET_MEDIUM


AI_FEATURES: tuple[AIFeature, ...] = (
    # ── Talk ────────────────────────────────────────────────────────────────────
    AIFeature(
        id="scene-chat",
        label="Scene Assistant",
        group="talk",
        classification="reflect",
        description="Think through the scene you are in: questions, angles, what is missing.",
        context=(
            "Scene title, synopsis and purpose",
            "Characters and threads in the scene, with how their body and mind show",
            "Adjacent scenes",
        ),
    ),
    AIFeature(
        id="writing-coach",
        label="Writing Coach",
        group="talk",
        classification="reflect",
        description="Craft feedback on a passage you select — what the prose is doing, not a rewrite.",
        context=("Selected text", "Scene prose", "Story tone and genre"),
    ),
    AIFeature(
        id="cliche-coach",
        label="Cliché Coach",
        group="talk",
        classification="reflect",
        description="Names the tired phrasing in a passage and asks what you meant instead.",
        context=("Selected text", "Scene prose"),
    ),
    AIFeature(
        id="identity-workshop",
        label="Story Identity Workshop",
        group="talk",
        classification="reflect",
        description="A conversation that helps you say what your story is about.",
        context=("Story identity fields", "Character roles and motivations", "Scene synopses"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="snowflake-guidance",
        label="Snowflake Guidance",
        group="talk",
        classification="reflect",
        description="Guidance for the Snowflake Method step you are on.",
        context=("Current Snowflake step", "Existing outline", "Story premise"),
    ),
    # ── Ask the cast ────────────────────────────────────────────────────────────
    AIFeature(
        id="interview",
        label="Character Interview",
        group="cast",
        classification="persona",
        description="Talk to a character as themselves, limited to what they know.",
        context=(
            "Full character profile",
            "Who they are: identity, body and mind, what formed them (unless kept out)",
            "Relationships",
            "Arc milestones",
            "Scenes they were present for",
        ),
    ),
    AIFeature(
        id="interview-summary",
        label="Interview Summary",
        group="cast",
        classification="summarise",
        description="Condenses an interview into what was revealed.",
        context=("Interview transcript",),
    ),
    AIFeature(
        id="interview-compaction",
        label="Interview Compaction",
        group="system",
        classification="summarise",
        description="Compresses older interview turns so a long conversation keeps fitting.",
        context=("Older interview messages",),
    ),
    AIFeature(
        id="panel-compaction",
        label="Group Interview Compaction",
        group="system",
        classification="summarise",
        description="Compresses the older turns of a group interview so a long one keeps fitting.",
        context=("Older group interview messages",),
    ),
    AIFeature(
        id="panel-character",
        label="Panel Interview",
        group="cast",
        classification="persona",
        description="Several characters answer the same question, each in their own voice.",
        context=("Each character's profile", "Relationships between them", "Panel transcript"),
    ),
    AIFeature(
        id="panel-orchestrator",
        label="Panel Turn Order",
        group="system",
        classification="analyse",
        description="Decides which panel members have something to say to a question.",
        context=("Character names and roles", "Panel transcript"),
        budget=BUDGET_SMALL,
    ),
    # ── Analyse ─────────────────────────────────────────────────────────────────
    AIFeature(
        id="arc-analysis",
        label="Arc Analysis",
        group="analyse",
        classification="analyse",
        description="How the story arc is tracking against its stated shape.",
        context=("Story structure", "Scene synopses", "Narrative intent"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="audience-adherence",
        label="Audience Fit",
        group="analyse",
        classification="analyse",
        description="Whether the content matches the audience you named.",
        context=("Scene prose", "Target audience", "Genre and tone"),
    ),
    AIFeature(
        id="character-arc",
        label="Character Arc Analysis",
        group="analyse",
        classification="analyse",
        description="Where a character stands in their arc right now.",
        context=("Character profile and arc notes", "Arc milestones", "Scenes mentioning them"),
    ),
    AIFeature(
        id="character-dimensionality",
        label="Character Depth",
        group="analyse",
        classification="analyse",
        description="Contradictions, relationship complexity and flatness across the cast.",
        context=("Character profiles", "Scene prose", "Relationships", "Thread involvement"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="character-journey",
        label="Character Journey",
        group="analyse",
        classification="summarise",
        description="A running account of what a character has been through so far.",
        context=("Scenes the character appears in", "Arc milestones", "Interview history"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="cliche-analysis",
        label="Cliché Check",
        group="analyse",
        classification="analyse",
        description="Overused phrasing, tropes and tired description, with locations.",
        context=("Scene prose",),
    ),
    AIFeature(
        id="continuity-check",
        label="Continuity Check",
        group="analyse",
        classification="analyse",
        description="Timeline, knowledge and detail contradictions between scenes.",
        context=("Scene prose", "Character profiles, pronouns and how their bodies show", "Story structure"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="dialogue-attribution",
        label="Dialogue Attribution",
        group="analyse",
        classification="analyse",
        description="Who is speaking in blocks the deterministic pass could not settle.",
        context=("Dialogue blocks", "Characters in the scene"),
    ),
    AIFeature(
        id="discovery",
        label="Element Extraction",
        group="analyse",
        classification="analyse",
        description="Names in the prose that look like unrecorded characters or places.",
        context=("Scene prose", "Existing Lorebook entries"),
    ),
    AIFeature(
        id="discovery-questions",
        label="Discovery Questions",
        group="analyse",
        classification="reflect",
        description="Questions whose answers would firm up the parts of the story you have not decided.",
        context=("Story identity", "Character profiles", "Plot threads"),
    ),
    AIFeature(
        id="economy-analysis",
        label="Story Economy",
        group="analyse",
        classification="analyse",
        description="Thread balance, scene economy and MICE tightness.",
        context=("Story structure", "MICE threads", "Scene synopses", "Word counts"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="editorial-pass",
        label="Editorial Pass",
        group="analyse",
        classification="analyse",
        description="Fresh-eyes read: priorities, intent gaps, voice notes, marginal comments.",
        context=("Scene prose", "Stated intent and purpose", "Story identity"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="essential-questions",
        label="Story Compass",
        group="analyse",
        classification="analyse",
        description="Whether the six essential story questions can be answered from what exists.",
        context=("Story intent and premise", "Character goals", "Plot threads", "Structure"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="extract-outline",
        label="Outline Extraction",
        group="analyse",
        classification="analyse",
        description="Turns written scenes into a structured outline you can correct.",
        context=("Scene prose", "Story title and genre"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="first-pass",
        label="First-Pass Editor",
        group="analyse",
        classification="analyse",
        description="Reads the prose against the intent and arc milestones you recorded.",
        context=("Scene prose", "Scene purpose and intent", "Arc milestones", "Narrative goals"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="image-analysis",
        label="Image Analysis",
        group="analyse",
        classification="analyse",
        description="Describes what is visible in an image you attached.",
        context=("The image", "Its caption and attachment context"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="import-extraction",
        label="Import Extraction",
        group="analyse",
        classification="analyse",
        description="Pulls character, location and relationship details out of an imported manuscript.",
        context=("Prose excerpts naming the candidate", "Other candidates in the same scenes"),
    ),
    AIFeature(
        id="import-structure",
        label="Import Structure Detection",
        group="analyse",
        classification="analyse",
        description="Proposes the act/chapter/scene split of an imported document.",
        context=("Imported document headings and paragraphs",),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="outline-alignment",
        label="Outline Alignment",
        group="analyse",
        classification="analyse",
        description="Where the manuscript has drifted from the outline.",
        context=("Outline items", "Scene synopses", "Story structure"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="talk-subjects",
        label="What They Talk About",
        group="analyse",
        classification="analyse",
        description="Says in a few words what each conversation between the chosen group is about, and whether it is about a man.",
        context=("The conversations found between the chosen group", "Each speaker's gender as the author wrote it"),
    ),
    AIFeature(
        id="pacing-analysis",
        label="Pacing Analysis",
        group="analyse",
        classification="analyse",
        description="Act balance, tension curve and structural rhythm.",
        context=("Story structure", "Scene synopses", "Word counts"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="plot-holes",
        label="Plot Holes",
        group="analyse",
        classification="analyse",
        description="Logical gaps, dropped questions and inconsistencies.",
        context=("Scene prose", "Story structure", "Plot threads", "Twists", "Character motivations"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="pronoun-identification",
        label="Pronoun Identification",
        group="analyse",
        classification="analyse",
        description="Finds the pronouns that refer to a character before the deterministic refactor runs.",
        context=("Scene prose", "Character names and aliases"),
    ),
    AIFeature(
        id="reader-knowledge-scan",
        label="Reader Knowledge Scan",
        group="analyse",
        classification="analyse",
        description="Detects reveals, misdirections and clues from scene synopses.",
        context=("Scene synopses (or openings)", "Characters", "Twists", "What the reader already knows"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="session-recap",
        label="Session Recap",
        group="analyse",
        classification="summarise",
        description="What changed in the story during this working session.",
        context=("Activity log for the session", "Scene synopses touched"),
    ),
    AIFeature(
        id="show-dont-tell",
        label="Show, Don't Tell",
        group="analyse",
        classification="analyse",
        description="Points at passages that state what could be shown, and names the telling.",
        context=("Scene prose", "Genre and tone"),
    ),
    AIFeature(
        id="story-summary",
        label="Story Summary",
        group="analyse",
        classification="summarise",
        description="A summary of everything written so far, with nothing added.",
        context=("All scene prose", "Story title and narrative intent"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="structure-summary",
        label="Section Summary",
        group="analyse",
        classification="summarise",
        description="Summarises one act, chapter or section on its own terms.",
        context=("Prose within the section", "Section purpose"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="system-analysis",
        label="World System Analysis",
        group="analyse",
        classification="analyse",
        description="Edge cases and story consequences of a world system's rules.",
        context=("System rules", "Other world systems", "Cultures that use it"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="theme-tracker",
        label="Theme Tracker",
        group="analyse",
        classification="analyse",
        description="Recurring themes and motifs, and where they develop.",
        context=("Scene prose", "Story intent"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="thread-analysis",
        label="Thread Analysis",
        group="analyse",
        classification="analyse",
        description="How a plot thread progresses, and where it goes quiet.",
        context=(
            "Thread description",
            "Where it opens and closes",
            "Try/fail cycles",
            "Its scenes in reading order, with your notes",
        ),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="travel-analysis",
        label="Travel Route Analysis",
        group="analyse",
        classification="analyse",
        description="Hazards, tensions and story potential along a route.",
        context=("Origin and destination", "World systems on the route", "Cultures along the way"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="twist-analysis",
        label="Twist Analysis",
        group="analyse",
        classification="analyse",
        description="Clue quality, distribution and whether the reveal lands.",
        context=("The truth and the misdirection", "Clues, before or after the reveal", "The reveal scene"),
    ),
    AIFeature(
        id="twist-impact",
        label="Twist Impact",
        group="analyse",
        classification="analyse",
        description="What changes downstream once a twist resolves.",
        context=(
            "The truth and the misdirection",
            "Clues and the reveal",
            "Plot threads",
            "Characters",
            "Scene synopses",
        ),
    ),
    AIFeature(
        id="voice-fidelity",
        label="Voice Fidelity",
        group="analyse",
        classification="analyse",
        description="Whether a character's dialogue stays in their own voice.",
        context=("The character's dialogue lines", "Their voice notes"),
    ),
    # ── Explore ─────────────────────────────────────────────────────────────────
    AIFeature(
        id="brainstorm",
        label="What's Next?",
        group="explore",
        classification="option",
        description="Short labelled directions the scene could take.",
        context=("Scene synopsis and purpose", "Plot threads", "Character arcs", "Adjacent scenes"),
    ),
    AIFeature(
        id="whatif",
        label="What-If",
        group="explore",
        classification="option",
        description="Consequences of an alternate choice — never the alternate scene.",
        context=("Story structure", "Plot threads", "Character motivations", "Lorebook"),
        budget=BUDGET_LARGE,
    ),
    AIFeature(
        id="scene-plan",
        label="Scene Planner",
        group="explore",
        classification="option",
        description="Questions and a few one-line beat options for a scene you are about to write.",
        context=("Scene title, synopsis and purpose", "Adjacent scenes", "Characters", "Active threads"),
    ),
    AIFeature(
        id="scene-atmosphere",
        label="Scene Atmosphere Cues",
        group="explore",
        classification="option",
        description="Short sensory cues per sense to write from — not description to paste.",
        context=("Scene setting and purpose", "Story tone"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="what-exists",
        label="What Exists Here",
        group="explore",
        classification="option",
        description="What would plausibly exist at a location, given the world you built.",
        context=("Location details", "World systems", "Connected cultures"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="element-suggest",
        label="World Element Suggestions",
        group="explore",
        classification="option",
        description="Naming, ritual and detail directions for a world element.",
        context=("The element's own fields", "Associated systems", "Related cultures and eras"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="historical-implications",
        label="Historical Implications",
        group="explore",
        classification="option",
        description="Present-day ripples of a historical event.",
        context=("Event details", "Era context", "Cultures and systems affected"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="calendar-suggestions",
        label="Calendar Suggestions",
        group="explore",
        classification="option",
        description="Festivals, seasons and observed days for a calendar.",
        context=("Calendar structure", "Associated cultures", "Historical events"),
        budget=BUDGET_SMALL,
    ),
    # ── Prepare ─────────────────────────────────────────────────────────────────
    AIFeature(
        id="character-attributes",
        label="Attribute Suggestions",
        group="prepare",
        classification="draft",
        description="Short suggestions for one Lorebook field, for you to pick from or edit.",
        context=("Character name, role and personality", "Existing traits", "Story context"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="character-from-image",
        label="Character from Image",
        group="prepare",
        classification="draft",
        description="What is visible in a reference image, plus attributes marked as suggestions.",
        context=("The image", "Existing character fields"),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="codex-suggest",
        label="Codex Suggestions",
        group="prepare",
        classification="analyse",
        description=(
            "Reads a scene and proposes who was in it and what it establishes, each quoting the line "
            "it read that from. Nothing counts until you confirm it."
        ),
        context=(
            "The scene's prose",
            "The cast, and who the graph already places in the scene",
            "Facts already recorded",
        ),
        budget=BUDGET_MEDIUM,
    ),
    AIFeature(
        id="relationship-suggest",
        label="Relationship Suggestions",
        group="prepare",
        classification="option",
        description="Dynamics worth recording between characters, confirmed before anything is created.",
        context=("Character profiles", "Existing relationships"),
    ),
    AIFeature(
        id="book-description",
        label="Book Description",
        group="prepare",
        classification="draft",
        description="Back-cover copy to rewrite in your own voice.",
        context=("Story identity", "Main characters", "Central conflict", "Themes"),
    ),
    AIFeature(
        id="query-letter",
        label="Query Letter",
        group="prepare",
        classification="draft",
        description="A query draft to rewrite — agents can tell when a letter was not written by the author.",
        context=("Story identity and word count", "Main characters and conflict", "Comp titles"),
    ),
    AIFeature(
        id="comp-titles",
        label="Comparable Titles",
        group="prepare",
        classification="option",
        description="Published books your story sits beside, with why.",
        context=("Genre, audience and tone", "Logline and premise", "Themes"),
        budget=BUDGET_SMALL,
    ),
    # ── Background ──────────────────────────────────────────────────────────────
    AIFeature(
        id="conversation-summarize",
        label="Conversation Summary",
        group="system",
        classification="summarise",
        description="Compresses a long AI conversation so it keeps fitting in context.",
        context=("The conversation so far",),
    ),
    AIFeature(
        id="session-title-generation",
        label="Session Title",
        group="system",
        classification="summarise",
        description="Names an AI session from its first exchange.",
        context=("First messages of the session",),
        budget=BUDGET_SMALL,
    ),
    AIFeature(
        id="scene-summary-batch",
        label="Scene Summaries",
        group="system",
        classification="summarise",
        description="Refreshes scene synopses in bulk so context assembly has something to use.",
        context=("Scene prose",),
    ),
)

FEATURES_BY_ID: dict[str, AIFeature] = {f.id: f for f in AI_FEATURES}

# Kept for the settings prompt cards, which key off this name.
FEATURE_LABELS: dict[str, str] = {f.id: f.label for f in AI_FEATURES}


def get_feature(feature_id: str) -> AIFeature | None:
    """The table row for a feature id, or None when the id is unknown."""
    return FEATURES_BY_ID.get(feature_id)


def feature_label(feature_id: str) -> str:
    """Human label for a feature id; falls back to a title-cased id so nothing renders raw."""
    feature = FEATURES_BY_ID.get(feature_id)
    if feature:
        return feature.label
    return feature_id.replace("-", " ").replace("_", " ").title()


def feature_budget(feature_id: str) -> int:
    """Context budget in tokens for a feature id (doc 06 §4)."""
    feature = FEATURES_BY_ID.get(feature_id)
    return feature.budget if feature else BUDGET_MEDIUM
