import type { AIFeatureInfo } from "./types";

/** Story mechanics — threads, twists, reader knowledge, discoveries. */
export const STORY_FEATURES: Record<string, AIFeatureInfo> = {
  "twist-analysis": {
    id: "twist-analysis",
    label: "Twist Analysis",
    type: "ai",
    shortDescription: "Review clue quality, distribution, and reveal effectiveness",
    fullDescription:
      "Reviews foreshadowing clue quality, clue distribution across the story, and how effectively the twist's reveal is set up — rating each dimension from needs-work to excellent.",
    contextSources: [
      "Twist name, description, and type",
      "Linked clues (scene, placement, subtlety)",
      "Scene synopses mentioning the twist",
    ],
    backendFeatureId: "twist-analysis",
  },
  "twist-impact": {
    id: "twist-impact",
    label: "Twist Impact",
    type: "ai",
    shortDescription: "Trace downstream effects when this twist resolves",
    fullDescription:
      "Identifies which plot threads, character arcs, and scenes need revisiting once this twist resolves, plus any loose ends the reveal creates.",
    contextSources: ["Twist name and description", "All plot threads", "Character arcs", "Scene synopses"],
    backendFeatureId: "twist-impact",
  },
  "reader-knowledge-scan": {
    id: "reader-knowledge-scan",
    label: "Auto-detect Knowledge Events",
    type: "ai",
    shortDescription: "Detect truth reveals, misdirections, and clues from scene synopses",
    fullDescription:
      "Reads through scene synopses to automatically identify truth reveals, misdirections, planted clues, and moments where reader knowledge diverges from character knowledge.",
    contextSources: ["Scene synopses (all scenes)", "Existing knowledge events (to avoid duplicates)"],
    backendFeatureId: "reader-knowledge-scan",
  },
  "thread-analysis": {
    id: "thread-analysis",
    label: "Thread Analysis",
    type: "ai",
    shortDescription: "Review thread progression, key moments, and narrative quality",
    fullDescription:
      "Reviews a plot thread's progression through the story — assessing try/fail cycles, key turning points, opening/closing balance, and overall narrative quality.",
    contextSources: [
      "Thread name, type, and description",
      "Scenes tagged to this thread",
      "Thread status and arc milestones",
    ],
    backendFeatureId: "thread-analysis",
  },
  "discovery-queue": {
    id: "discovery-queue",
    label: "Entity Discovery",
    type: "nlp",
    shortDescription: "Suggested Lorebook entries from names found in prose",
    fullDescription:
      "Runs named entity recognition across all scenes and collects character and location names not yet in the Lorebook, queuing them for review.",
    contextSources: ["Scene prose text (all scenes)", "Existing Lorebook entries"],
  },
  discovery: {
    id: "discovery",
    label: "Element Extraction",
    type: "ai",
    shortDescription: "Names in the prose that look like unrecorded story elements",
    fullDescription:
      "Reads prose for characters, places and things that are not in the Lorebook yet and proposes them for the discovery queue. Every suggestion needs your confirmation.",
    contextSources: ["Scene prose text", "Existing Lorebook entries"],
    backendFeatureId: "discovery",
  },
};
