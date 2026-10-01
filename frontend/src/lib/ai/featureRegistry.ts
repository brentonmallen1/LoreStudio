/**
 * Central registry of all AI and NLP features in LoreStudio.
 *
 * Each entry describes what the feature does, what data it uses,
 * and which page(s) it appears on — used by AIFeatureInfoModal to
 * explain features to the author before they run them.
 */

import { HEALTH_FEATURES } from "./registry/health";
import { PANEL_FEATURES } from "./registry/panel";
import { CHARACTERS_FEATURES } from "./registry/characters";
import { WORLD_FEATURES } from "./registry/world";
import { SCENES_FEATURES } from "./registry/scenes";
import { STORY_FEATURES } from "./registry/story";
import { IMPORTING_FEATURES } from "./registry/importing";
import type { AIFeatureInfo } from "./registry/types";
import type { UIMode } from "../mode";

export type { AIFeatureInfo, FeatureType } from "./registry/types";

/**
 * Every surface, merged. Entries live in ./registry, one module per page group, so a
 * new feature is added next to its neighbours rather than at the end of a long file.
 */
const FEATURES: Record<string, AIFeatureInfo> = {
  ...HEALTH_FEATURES,
  ...PANEL_FEATURES,
  ...CHARACTERS_FEATURES,
  ...WORLD_FEATURES,
  ...SCENES_FEATURES,
  ...STORY_FEATURES,
  ...IMPORTING_FEATURES,
};

export default FEATURES;

/**
 * Maps page IDs to the feature IDs available on that page.
 * Used by AIFeatureInfoModal to know which features to show.
 */
export const PAGE_FEATURES: Record<string, string[]> = {
  findings: [
    "prose-nlp",
    "entity-discovery",
    "editorial-consistency",
    "economy-analysis",
    "essential-questions",
    "pacing-analysis",
    "continuity-check",
    "theme-tracker",
    "plot-holes",
    "first-pass",
    "cliche-analysis",
    "character-dimensionality",
    "arc-analysis",
    "editorial-pass",
  ],
  "ai-panel": [
    "session-interview",
    "session-panel",
    "session-scene-assistant",
    "session-story-assistant",
    "session-writing-coach",
    "session-cliche-coach",
    "session-whatif",
    "session-discovery-questions",
    "session-show-dont-tell",
    "session-audience-adherence",
    "session-book-description",
    "session-query-letter",
    "session-scene-atmosphere",
    "interview-summary",
    "session-recap",
    "comp-titles",
  ],
  "character-sheet": [
    "session-interview",
    "character-role",
    "character-type-classification",
    "character-jungian-archetype",
    "character-narrative-archetype",
    "character-attributes",
    "character-dimensionality",
    "character-arc",
    "dialogue-voice",
    "dialogue-prose",
    "character-tag-dialogue",
    "character-journey",
    "voice-fidelity",
    "character-from-image",
    "pronoun-identification",
  ],
  worldbuilding: [
    "wb-what-exists",
    "wb-location-suggest",
    "wb-culture-suggest",
    "wb-implications",
    "wb-system",
    "wb-calendar",
    "wb-travel",
  ],
  "scene-editor": [
    "story-summary",
    "scene-plan",
    "brainstorm",
    "auto-tag-dialogue",
    "auto-link-entities",
    "dialogue-attribution",
  ],
  outline: ["extract-outline", "snowflake-guidance", "outline-alignment"],
  codex: ["codex-suggestions"],
  "discovery-queue": ["discovery-queue", "discovery"],
  twists: ["twist-analysis", "twist-impact", "reader-knowledge-scan"],
  "plot-threads": ["thread-analysis"],
  "story-identity": ["identity-workshop", "story-summary", "perspective-summary"],
  media: ["image-analysis", "character-from-image"],
  import: [
    "import-ner-characters",
    "import-ner-locations",
    "import-ai-character-details",
    "import-ai-location-details",
    "import-ai-relationships",
    "import-structure",
  ],
};

/**
 * The features on a page that this mode may see.
 *
 * Writer mode renders no AI affordance, but NLP tools stay in both modes — so a page with
 * both keeps its NLP half rather than going dark. Used by the info trigger, which hides
 * itself only when nothing is left to describe, and by the modal that lists them.
 */
export function visibleFeatures(pageId: string, mode: UIMode): AIFeatureInfo[] {
  return (PAGE_FEATURES[pageId] ?? [])
    .map((id) => FEATURES[id])
    .filter((f): f is AIFeatureInfo => !!f && (mode === "studio" || f.type !== "ai"));
}

/**
 * Human-readable page labels shown in the modal title.
 */
export const PAGE_LABELS: Record<string, string> = {
  findings: "Findings",
  "ai-panel": "AI Assistant",
  "character-sheet": "Character Sheet",
  worldbuilding: "World Building",
  "scene-editor": "Scene Editor",
  outline: "Plan",
  codex: "Codex Review",
  "discovery-queue": "Discovery Queue",
  twists: "Twists & Misdirection",
  "plot-threads": "Plot Threads",
  "story-identity": "Story Identity",
  media: "Media & Assets",
  import: "Document Import",
};
