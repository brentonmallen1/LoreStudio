import type { StoryStructureTemplate } from "../types";

/**
 * A structure template as New Story offers it (doc 29 P1, doc 30 D1): "a shape", in plain
 * words. A shape is only names for the big parts of a story; its own name, when it has one
 * a writer might have heard, is small print. A shape the writer made keeps its own words.
 */
const PLAIN: Record<string, { name: string; line: string; knownAs?: string }> = {
  freeform: { name: "Freeform", line: "sections and scenes, nothing more" },
  "three-act": { name: "Three acts", line: "a beginning, a middle and an end, each with chapters" },
  "seven-point": {
    name: "Seven turns",
    line: "seven moments where the story changes direction, with scenes under each",
    knownAs: "the seven-point structure",
  },
  snowflake: {
    name: "Parts and chapters",
    line: "a few big parts, each with chapters of scenes",
    knownAs: "the Snowflake method's shape",
  },
  "heros-journey": {
    name: "The hero's journey",
    line: "stages of leaving home, being tested and coming back changed",
  },
  "mice-single": {
    name: "One question, opened and closed",
    line: "for flash and short stories: an opening, tries that fail, and how it ends",
  },
  "mice-nested": {
    name: "Questions inside questions",
    line: "for longer short stories: each question opened, then closed in turn",
  },
  screenplay: { name: "Three acts of scenes", line: "each scene opening on where and when it happens" },
  "screenplay-sequences": {
    name: "Acts of sequences",
    line: "runs of scenes that carry one goal through, eight or so to a feature",
  },
  "tv-half-hour": { name: "TV half-hour", line: "a cold open, two acts and a tag, about 30 pages" },
  "tv-hour": { name: "TV hour", line: "a teaser and five acts, about 55 pages" },
  "stage-play": { name: "Acts and scenes", line: "for the theatre; a one-act play keeps one act" },
};

export function shapeName(t: Pick<StoryStructureTemplate, "id" | "name">): string {
  return PLAIN[t.id]?.name ?? t.name;
}

/** One line on what the shape is, after its name. */
export function shapeLine(t: Pick<StoryStructureTemplate, "id" | "description">): string {
  return PLAIN[t.id]?.line ?? t.description;
}

/** Its name elsewhere, when a writer might know it by that: small print. */
export function shapeKnownAs(t: Pick<StoryStructureTemplate, "id">): string | undefined {
  return PLAIN[t.id]?.knownAs;
}

/** How many shapes the list shows before "N more shapes". */
export const SHAPES_SHOWN = 3;
