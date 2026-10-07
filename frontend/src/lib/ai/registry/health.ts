import type { AIFeatureInfo } from "./types";

/** Findings (was Story Health): the whole-manuscript checks, local (NLP) and Assistant. */
export const HEALTH_FEATURES: Record<string, AIFeatureInfo> = {
  "prose-nlp": {
    id: "prose-nlp",
    label: "Prose Check",
    type: "nlp",
    shortDescription: "Passive voice, adverbs, said-bookisms, repeated words",
    fullDescription:
      "Scans every scene for passive voice, excessive adverbs, said-bookisms, repeated words, and sentence variety. Runs locally: no AI or internet required.",
    contextSources: ["Scene prose text (all scenes)"],
  },
  "scene-summaries": {
    id: "scene-summaries",
    label: "Scene Summaries",
    type: "ai",
    shortDescription: "Write the missing and out-of-date scene summaries",
    fullDescription:
      "Writes a short summary of each written scene that has none, or whose text changed after its summary was written. Other Assistant features read these when they need scenes they are not reading in full.",
    contextSources: ["Scene prose text (each scene that needs a summary)"],
    backendFeatureId: "scene-summary-batch",
  },
  "talk-subjects": {
    id: "talk-subjects",
    label: "What They Talk About",
    type: "ai",
    shortDescription: "What each conversation in Talking to each other is about",
    fullDescription:
      "Reads only the conversations Talking to each other found, and says in a few words what each is about and whether its subject is a man in the story. It describes; it never says whether anything passes or fails.",
    contextSources: [
      "The conversations found between the chosen group",
      "Each speaker's gender as you wrote it",
    ],
    backendFeatureId: "talk-subjects",
  },
  "entity-discovery": {
    id: "entity-discovery",
    label: "Lorebook Scan",
    type: "nlp",
    shortDescription: "Find character & location names not yet in Lorebook",
    fullDescription:
      "Uses named entity recognition to find characters and locations mentioned in your prose that aren't yet tracked in the Lorebook. Runs locally: no AI required.",
    contextSources: ["Scene prose text (all scenes)", "Existing Lorebook entries"],
  },
  "editorial-consistency": {
    id: "editorial-consistency",
    label: "Editorial Check",
    type: "nlp",
    shortDescription: "Tense consistency and POV drift, no AI required",
    fullDescription:
      "Detects tense shifts and point-of-view drift across scenes. Deterministic rule-based analysis that runs locally with no AI required.",
    contextSources: ["Scene prose text (all scenes)"],
  },
  "economy-analysis": {
    id: "economy-analysis",
    label: "Story Economy",
    type: "ai",
    shortDescription: "Thread balance, scene economy, MICE tightness",
    fullDescription:
      "Analyzes MICE thread balance, scene economy, try/fail cycles, and whether word count is distributed effectively for the intended form.",
    contextSources: ["Story structure", "MICE thread data", "Scene synopses", "Word counts"],
    backendFeatureId: "economy-analysis",
  },
  "essential-questions": {
    id: "essential-questions",
    label: "Story Compass",
    type: "ai",
    shortDescription: "Are the 6 essential story questions answerable?",
    fullDescription:
      "Checks whether the six essential story questions (goal, motivation, conflict, stakes, change, resolution) are clearly answerable for the protagonist.",
    contextSources: [
      "Story intent & premise",
      "Character goals & motivation",
      "Plot threads",
      "Story structure",
    ],
    backendFeatureId: "essential-questions",
  },
  "pacing-analysis": {
    id: "pacing-analysis",
    label: "Pacing Analysis",
    type: "ai",
    shortDescription: "Act balance, tension curve, structural rhythm",
    fullDescription:
      "Reviews act balance, tension curve, and scene rhythm to identify slow spots, rushed sections, and structural imbalances.",
    contextSources: ["Story structure", "Scene synopses", "Word counts", "MICE threads"],
    backendFeatureId: "pacing-analysis",
  },
  "continuity-check": {
    id: "continuity-check",
    label: "Continuity Check",
    type: "ai",
    shortDescription: "Character knowledge, timeline, and detail inconsistencies",
    fullDescription:
      "Flags inconsistencies in character knowledge, timeline, object details, and cause-and-effect across your scenes.",
    contextSources: ["Scene prose text", "Character profiles", "Story structure"],
    backendFeatureId: "continuity-check",
  },
  "theme-tracker": {
    id: "theme-tracker",
    label: "Theme Tracker",
    type: "ai",
    shortDescription: "Recurring themes, motifs, and their development",
    fullDescription:
      "Identifies recurring themes and motifs in the prose and assesses how they develop across the story arc.",
    contextSources: ["Scene prose text", "Story intent & premise", "Plot threads"],
    backendFeatureId: "theme-tracker",
  },
  "plot-holes": {
    id: "plot-holes",
    label: "Plot Holes",
    type: "ai",
    shortDescription: "Logical gaps, unanswered questions, inconsistencies",
    fullDescription:
      "Detects logical gaps, unresolved story questions, and cause-and-effect inconsistencies in the narrative.",
    contextSources: ["Scene prose text", "Story structure", "Plot threads", "Character motivations"],
    backendFeatureId: "plot-holes",
  },
  "first-pass": {
    id: "first-pass",
    label: "First-Pass Editor",
    type: "ai",
    shortDescription: "Compare prose against stated intent and arc milestones",
    fullDescription:
      "Compares the written scenes against your stated narrative intent, scene purposes, and character arc milestones to surface gaps between plan and execution.",
    contextSources: [
      "Scene prose text",
      "Scene purpose & intent",
      "Character arc milestones",
      "Narrative goals",
    ],
    backendFeatureId: "first-pass",
  },
  "cliche-analysis": {
    id: "cliche-analysis",
    label: "Cliche Check",
    type: "ai",
    shortDescription: "Overused phrases, tropes, and tired descriptions",
    fullDescription:
      "Scans for overused phrases, character tropes, plot devices, and tired descriptions that could make the writing feel generic.",
    contextSources: ["Scene prose text"],
    backendFeatureId: "cliche-analysis",
  },
  "character-dimensionality": {
    id: "character-dimensionality",
    label: "Character Depth",
    type: "ai",
    shortDescription: "Dimensionality, contradictions, relationship complexity",
    fullDescription:
      "Assesses each character's dimensionality, internal contradictions, relationship complexity, and whether their role in the story is being used appropriately.",
    contextSources: [
      "Character profiles",
      "Scene prose text",
      "Relationship graph",
      "Plot thread involvement",
    ],
    backendFeatureId: "character-dimensionality",
  },
  "arc-analysis": {
    id: "arc-analysis",
    label: "Arc Analysis",
    type: "ai",
    shortDescription: "Is the story arc tracking the shape you said it had?",
    fullDescription:
      "Reads the structure and scene synopses against your stated narrative intent and reports where the arc bends away from it.",
    contextSources: ["Story structure", "Scene synopses", "Narrative intent"],
    backendFeatureId: "arc-analysis",
  },
  "editorial-pass": {
    id: "editorial-pass",
    label: "Editorial Pass",
    type: "ai",
    shortDescription: "Fresh-eyes read: priorities, intent gaps, marginal notes",
    fullDescription:
      "A developmental read of the manuscript against the intent you recorded: what to fix first, where the prose and the plan disagree, voice notes, and margin comments. Comments only: it never rewrites.",
    contextSources: ["Scene prose text", "Scene purpose & intent", "Story identity"],
    backendFeatureId: "editorial-pass",
  },
};
