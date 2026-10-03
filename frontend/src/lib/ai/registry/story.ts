import type { AIFeatureInfo } from "./types";

/** Story mechanics — threads, twists, reader knowledge, discoveries. */
export const STORY_FEATURES: Record<string, AIFeatureInfo> = {
  "codex-suggestions": {
    id: "codex-suggestions",
    label: "Codex Suggestions",
    type: "ai",
    shortDescription: "Propose who was in a scene and what it establishes, quoting the line",
    fullDescription:
      "The Codex works out who is in a scene from point of view, dialogue tags and names in the prose. " +
      'Good writing defeats all three: you write "the keeper", not "Elena". This reads your scenes and ' +
      "proposes what those signals missed, and what each scene establishes as true, quoting the words it " +
      "read that from. It never proposes what should happen next and never invents a character. Nothing " +
      "it finds counts until you confirm it, and confirming writes a real Lorebook row.",
    contextSources: [
      "The scene's prose",
      "Your cast, and who the graph already places in the scene",
      "Facts already recorded, so it does not repeat them",
    ],
    backendFeatureId: "codex-suggest",
  },
  "twist-analysis": {
    id: "twist-analysis",
    label: "Twist Analysis",
    type: "ai",
    shortDescription: "Review clue quality, distribution, and reveal effectiveness",
    fullDescription:
      "Reviews foreshadowing clue quality, clue distribution across the story, and how effectively the twist's reveal is set up, rating each dimension from needs-work to excellent.",
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
    label: "Find what the reader learns",
    type: "ai",
    shortDescription: "Propose what the reader learns, scene by scene; each waits in Proposals",
    fullDescription:
      "Reads the scenes in order (the synopsis, or the opening of a scene with none) and proposes what the reader learns where: truths revealed, misdirections planted, clues, and moments only the reader knows. Each waits in Proposals for a yes; people are named from your cast and an event can say which twist it serves.",
    contextSources: [
      "Scene synopses or openings, in reading order",
      "Characters",
      "Twists",
      "What the reader already knows",
    ],
    backendFeatureId: "reader-knowledge-scan",
  },
  "thread-analysis": {
    id: "thread-analysis",
    label: "Thread Analysis",
    type: "ai",
    shortDescription: "Review thread progression, key moments, and narrative quality",
    fullDescription:
      "Reviews a plot thread's progression through the story, assessing try/fail cycles, key turning points, opening/closing balance, and overall narrative quality.",
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
