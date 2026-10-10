import type { StoryFormat } from "../types";

/**
 * What a story's intended length means, by format (doc 25, P5): words for prose, pages for a
 * script. Mirrors backend services/word_count.LENGTH_TARGETS; the Story identity options, the
 * overview, Numbers and the status corner all read it here.
 */
export interface LengthForm {
  min: number | null;
  max: number | null;
  /** As a name: "Short story", "TV hour". */
  label: string;
  /** As the Story identity option, with its range. */
  option: string;
  /** In a sentence: "a short story", "a TV hour". */
  phrase: string;
}

export const LENGTH_TARGETS: Record<StoryFormat, Record<string, LengthForm>> = {
  prose: {
    flash_fiction: {
      min: 0,
      max: 1_000,
      label: "Flash fiction",
      option: "Flash fiction (<1K words)",
      phrase: "flash fiction",
    },
    short_story: {
      min: 1_000,
      max: 7_500,
      label: "Short story",
      option: "Short story (1K–7.5K words)",
      phrase: "short story",
    },
    novelette: {
      min: 7_500,
      max: 17_500,
      label: "Novelette",
      option: "Novelette (7.5K–17.5K words)",
      phrase: "novelette",
    },
    novella: {
      min: 17_500,
      max: 40_000,
      label: "Novella",
      option: "Novella (17.5K–40K words)",
      phrase: "novella",
    },
    novel: { min: 40_000, max: 100_000, label: "Novel", option: "Novel (40K–100K words)", phrase: "novel" },
    epic_saga: {
      min: 100_000,
      max: null,
      label: "Epic / saga",
      option: "Epic / saga (100K+ words)",
      phrase: "epic",
    },
    series: { min: null, max: null, label: "Series", option: "Series (multi-book)", phrase: "series" },
  },
  screenplay: {
    short_film: {
      min: 1,
      max: 40,
      label: "Short film",
      option: "Short film (up to 40 pages)",
      phrase: "short film",
    },
    tv_half_hour: {
      min: 22,
      max: 38,
      label: "TV half-hour",
      option: "TV half-hour (22–38 pages)",
      phrase: "TV half-hour",
    },
    tv_hour: { min: 45, max: 65, label: "TV hour", option: "TV hour (45–65 pages)", phrase: "TV hour" },
    feature: {
      min: 90,
      max: 120,
      label: "Feature film",
      option: "Feature film (90–120 pages)",
      phrase: "feature",
    },
  },
};

/** Prose's forms, by their old name. */
export const WORD_COUNT_RANGES = LENGTH_TARGETS.prose;

/** A form by its key, in whichever format has it. */
export function lengthForm(key: string | null | undefined): LengthForm | undefined {
  if (!key) return undefined;
  return LENGTH_TARGETS.prose[key] ?? LENGTH_TARGETS.screenplay[key];
}

/** The Story identity choices for a format: none, then its forms in order. */
export function lengthOptions(format: StoryFormat): [string, string][] {
  return [
    ["", "Not specified"],
    ...Object.entries(LENGTH_TARGETS[format]).map(([k, f]): [string, string] => [k, f.option]),
  ];
}
