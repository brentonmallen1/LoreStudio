import type { AIFeatureInfo } from "./types";

/** Manuscript — the scene editor, the outline and story identity. */
export const SCENES_FEATURES: Record<string, AIFeatureInfo> = {
  "scene-plan": {
    id: "scene-plan",
    label: "Plan Scene",
    type: "ai",
    shortDescription: "AI-guided scene planning before you write",
    fullDescription:
      "Helps you plan a scene before writing it, proposing purpose, character goals, entry/exit states, and key beats based on your story context.",
    contextSources: [
      "Scene title & synopsis",
      "Adjacent scenes",
      "Characters in scene",
      "Active plot threads",
      "Story structure",
    ],
    backendFeatureId: "scene-plan",
  },
  brainstorm: {
    id: "brainstorm",
    label: "What's Next?",
    type: "ai",
    shortDescription: "Brainstorm directions for this scene or next scene",
    fullDescription:
      "A brainstorming partner that suggests narrative directions, complications, and next moves based on where the scene currently stands, without writing the prose for you.",
    contextSources: [
      "Scene synopsis & purpose",
      "Current scene prose",
      "Plot threads",
      "Character arcs",
      "Adjacent scenes",
    ],
    backendFeatureId: "brainstorm",
  },
  "auto-tag-dialogue": {
    id: "auto-tag-dialogue",
    label: "Auto-Tag Dialogue",
    type: "ai",
    shortDescription: "Suggest speaker tags for untagged dialogue lines",
    fullDescription:
      "Analyzes the scene's dialogue to suggest speaker tags for lines that aren't yet attributed to a character.",
    contextSources: ["Scene prose text", "Character names in scene"],
  },
  "auto-link-entities": {
    id: "auto-link-entities",
    label: "Auto-Link Entities",
    type: "ai",
    shortDescription: "Find characters & locations in prose to link to Lorebook",
    fullDescription:
      "Scans the scene prose for character names and location names and suggests linking them to existing Lorebook entries.",
    contextSources: ["Scene prose text", "Lorebook character and location entries"],
  },
  "extract-outline": {
    id: "extract-outline",
    label: "Extract Outline from Prose",
    type: "ai",
    shortDescription: "Generate a structured outline from written scenes",
    fullDescription:
      "Analyzes the written prose to extract a structured outline (scene titles, synopses, and key events), helping authors who drafted first and want to build structure after.",
    contextSources: ["Scene prose text (all scenes)", "Story title & genre"],
    backendFeatureId: "extract-outline",
  },
  "snowflake-guidance": {
    id: "snowflake-guidance",
    label: "Snowflake Guidance",
    type: "ai",
    shortDescription: "Guidance for the current Snowflake Method step",
    fullDescription:
      "Provides contextual guidance and questions for whichever step of the Snowflake Method you're currently working on.",
    contextSources: ["Current Snowflake step", "Existing outline content", "Story premise"],
    backendFeatureId: "snowflake-guidance",
  },
  "story-summary": {
    id: "story-summary",
    label: "Story Summary",
    type: "ai",
    shortDescription: "Generate a concise summary of everything written so far",
    fullDescription:
      "Reads all written scenes and generates a concise narrative summary, useful for catching up after a break or sharing story progress.",
    contextSources: ["All scene prose text", "Story title and narrative intent"],
    backendFeatureId: "story-summary",
  },
  "perspective-summary": {
    id: "perspective-summary",
    label: "Perspective Summary",
    type: "ai",
    shortDescription: "Summarize the story from a character or section's perspective",
    fullDescription:
      "Summarizes the story from the perspective of a specific character (what they've experienced) or a structural section (what has happened in that act/chapter).",
    contextSources: [
      "Scene prose text for the selected scope",
      "Character profile (for character perspective)",
      "Story intent",
    ],
    backendFeatureId: "structure-summary",
  },
  "identity-workshop": {
    id: "identity-workshop",
    label: "Story Identity Workshop",
    type: "ai",
    shortDescription: "Conversational guide to help you articulate your story's identity",
    fullDescription:
      "A Socratic dialogue tool that asks questions to help you discover and articulate your story's logline, premise, themes, narrative intent, and central conflict. The AI never writes content for you; it asks questions, surfaces observations, and prompts deeper thinking so the words remain entirely yours.",
    contextSources: [
      "Story title, genre, tone, and existing identity fields",
      "Character names, roles, and motivations",
      "Scene synopses and structure",
    ],
    backendFeatureId: "identity-workshop",
  },
  "dialogue-attribution": {
    id: "dialogue-attribution",
    label: "Attribute Dialogue",
    type: "ai",
    shortDescription: "Who is speaking in the blocks the rules could not settle",
    fullDescription:
      "The deterministic pass tags what it can from speech tags and turn order; this asks the model only about the blocks that stayed ambiguous.",
    contextSources: ["Unattributed dialogue blocks", "Characters in the scene"],
    backendFeatureId: "dialogue-attribution",
  },
  "outline-alignment": {
    id: "outline-alignment",
    label: "Outline Alignment",
    type: "ai",
    shortDescription: "Where the manuscript has drifted from the outline",
    fullDescription:
      "Compares outline items against what the scenes actually do, and reports drift in both directions: outline items with no scene, scenes with no outline item.",
    contextSources: ["Outline items", "Scene synopses", "Story structure"],
    backendFeatureId: "outline-alignment",
  },
  "image-analysis": {
    id: "image-analysis",
    label: "Image Analysis",
    type: "ai",
    shortDescription: "Describe what is visible in an attached image",
    fullDescription:
      "Describes an image you attached to the story so it can be searched and captioned. Requires a vision-capable model.",
    contextSources: ["The image", "Its caption and attachment context"],
    backendFeatureId: "image-analysis",
  },
};
