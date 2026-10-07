import { WHO_FIELDS } from "./whoAreThey";

/**
 * Every kind of Lorebook entry, declared once (doc 12 P2, D2): the text fields its sheet
 * shows, in order, with the hint an empty one gives; which of them the side panel's compact
 * sheet carries; the words its badges and list rows use. The full sheet, the compact sheet
 * and the "empty is quiet" Add row all read this table, so a field added here appears
 * everywhere it should and nowhere it should not.
 */

export type LoreKind =
  | "character"
  | "location"
  | "thread"
  | "twist"
  | "system"
  | "culture"
  | "era"
  | "event"
  | "calendar"
  | "travel";

export interface FieldSpec {
  /** The model column. */
  key: string;
  label: string;
  /** A short name where the label is a question: the Add row's chip, a comparison across books. */
  name?: string;
  /** What an empty field asks, shown as the textarea's placeholder once revealed. */
  hint: string;
  /** One line (an input) rather than a paragraph. */
  short?: boolean;
  /** Suggestions for a short field (a datalist, so anything else can still be typed); a note
   *  says where a word comes from without becoming part of it. */
  options?: (string | { value: string; note: string })[];
  /** Carried by the compact sheet in the side panel. */
  compact?: boolean;
}

export interface KindSpec {
  label: string;
  plural: string;
  fields: FieldSpec[];
  /** Fields another view of the sheet shows (a character's Who are they), for labels elsewhere. */
  extra?: FieldSpec[];
}

/**
 * The three questions (doc 20 P5): Debra Dixon's Goal, Motivation and Conflict, and the stakes
 * many writers add. The character sheet shows them first, together, as questions.
 */
export const CHARACTER_QUESTIONS = ["mission_statement", "motivation", "conflict", "stakes"];

/** Place types as the old editor stored them (snake case); shown with spaces. */
const LOCATION_TYPE_VALUES = [
  "star_system",
  "star",
  "planet",
  "gas_giant",
  "moon",
  "asteroid_belt",
  "orbital_station",
  "space_habitat",
  "continent",
  "region",
  "territory",
  "settlement",
  "district",
  "landmark",
  "structure",
  "natural_feature",
  "vessel",
];

export const CELESTIAL_TYPES = new Set(LOCATION_TYPE_VALUES.slice(0, 8));

/** "natural_feature" → "natural feature", for reading. */
export function typeLabel(value: string): string {
  return value.replace(/_/g, " ");
}

/** "Natural feature" → "natural_feature", the way types are stored. */
export function typeValue(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "_");
}

const LOCATION_TYPES = LOCATION_TYPE_VALUES.map(typeLabel);

export const KINDS: Record<LoreKind, KindSpec> = {
  character: {
    label: "Character",
    plural: "Characters",
    extra: WHO_FIELDS,
    fields: [
      {
        key: "mission_statement",
        label: "What do they want?",
        name: "Wants",
        hint: "What they're after: the goal they'd tell you, in one sentence…",
        compact: true,
      },
      { key: "motivation", label: "Why?", name: "Why", hint: "Why they want it…", compact: true },
      {
        key: "conflict",
        label: "What stands in the way?",
        name: "Against",
        hint: "What stands between them and what they want…",
        compact: true,
      },
      {
        key: "stakes",
        label: "What if they don't get it?",
        name: "Stakes",
        hint: "What happens if they fail: what they lose, what it costs…",
      },
      { key: "need", label: "Needs", hint: "What they actually need, often without knowing it…" },
      {
        key: "lie",
        label: "Believes",
        hint: "The lie: what they believe that isn't so, and the story will test…",
      },
      {
        key: "personality",
        label: "Personality",
        hint: "How they come across, and what is underneath…",
        compact: true,
      },
      { key: "epiphany", label: "Epiphany", hint: "What they learn by the end, or refuse to…" },
      {
        key: "flaws",
        label: "Flaws",
        hint: "What gets in their way: the fault they cannot see…",
        compact: true,
      },
      { key: "background", label: "Background", hint: "Where they come from…" },
      { key: "appearance", label: "Appearance", hint: "What someone notices first…" },
      { key: "quirks", label: "Quirks", hint: "Habits and tics that make them particular…" },
      {
        key: "speech_patterns",
        label: "Speech patterns",
        hint: "How they talk: rhythm, favourite words, what they never say…",
      },
      { key: "arc_notes", label: "Arc notes", hint: "Where they start, where they end…" },
      {
        key: "narrative_intent",
        label: "Narrative intent",
        hint: "What is this character FOR in your story? Arc trajectory, key moments, thematic role.",
      },
      {
        key: "arc_in_own_words",
        label: "In their own words",
        hint: "Their whole arc told in first person: where they began, what happened, where they ended.",
      },
    ],
  },
  location: {
    label: "Place",
    plural: "Places",
    fields: [
      {
        key: "location_type",
        label: "Type",
        hint: "Structure, settlement, natural feature…",
        short: true,
        options: LOCATION_TYPES,
      },
      { key: "description", label: "Description", hint: "What is here?", compact: true },
      { key: "atmosphere", label: "Atmosphere", hint: "What does it feel like to be here?", compact: true },
      { key: "history", label: "History", hint: "What happened here before the story?" },
      {
        key: "significance",
        label: "Significance",
        hint: "Why does this place matter to the story?",
        compact: true,
      },
      { key: "climate", label: "Climate", hint: "Temperate, arctic, storm-bound…", short: true },
      { key: "terrain", label: "Terrain", hint: "Mountainous, coastal, dense forest…", short: true },
      { key: "political_affiliation", label: "Political affiliation", hint: "Who governs it?", short: true },
      { key: "orbital_period", label: "Orbital period", hint: "e.g. 365 days", short: true },
      { key: "distance_from_parent", label: "Distance from parent", hint: "e.g. 1 AU", short: true },
      { key: "gravity", label: "Gravity", hint: "e.g. 0.8 g", short: true },
      { key: "habitability", label: "Habitability", hint: "Who or what can live here?", short: true },
      { key: "radiation_level", label: "Radiation", hint: "e.g. low", short: true },
    ],
  },
  thread: {
    label: "Plot thread",
    plural: "Plot threads",
    fields: [
      {
        key: "description",
        label: "What it asks",
        hint: "The question this thread asks the reader, or the change it makes…",
        compact: true,
      },
    ],
  },
  twist: {
    label: "Twist",
    plural: "Twists",
    fields: [
      { key: "the_truth", label: "The truth", hint: "What is really going on…", compact: true },
      {
        key: "the_misdirection",
        label: "The misdirection",
        hint: "What the reader is led to believe…",
        compact: true,
      },
    ],
  },
  system: {
    label: "System",
    plural: "Systems",
    fields: [
      {
        key: "system_type",
        label: "Type",
        hint: "Magic, technology, social…",
        short: true,
        options: ["magic", "technology", "power", "social", "economic", "religious", "natural", "symbolic"],
      },
      { key: "source_origin", label: "Source", hint: "Where does it come from?", compact: true },
      { key: "rules", label: "Rules", hint: "How does it work?", compact: true },
      { key: "limitations", label: "Limitations", hint: "What can it not do?", compact: true },
      { key: "costs", label: "Costs", hint: "What does using it take from someone?", compact: true },
      { key: "notes", label: "Notes", hint: "Anything else worth keeping…" },
    ],
  },
  culture: {
    label: "Culture",
    plural: "Cultures",
    fields: [
      { key: "description", label: "Description", hint: "Who are these people?", compact: true },
      { key: "values", label: "Values", hint: "What do they hold dear?", compact: true },
      { key: "customs", label: "Customs", hint: "What do they do, and when?", compact: true },
      { key: "taboos", label: "Taboos", hint: "What is never done or said?", compact: true },
      { key: "religion", label: "Religion", hint: "What do they believe?" },
      {
        key: "social_hierarchy",
        label: "Social hierarchy",
        hint: "Who is above whom, and how is it decided?",
      },
      { key: "government_type", label: "Government", hint: "Council, monarchy, none…", short: true },
      { key: "economy", label: "Economy", hint: "How do they live and trade?" },
      { key: "notes", label: "Notes", hint: "Anything else worth keeping…" },
    ],
  },
  era: {
    label: "Era",
    plural: "Eras",
    fields: [
      { key: "start_date", label: "From", hint: "e.g. 1894", short: true },
      { key: "end_date", label: "To", hint: "e.g. present", short: true },
      { key: "description", label: "Description", hint: "What was this time?", compact: true },
      { key: "characteristics", label: "Characteristics", hint: "What marked it out?", compact: true },
    ],
  },
  event: {
    label: "Event",
    plural: "Events",
    fields: [
      { key: "in_world_date", label: "When", hint: "e.g. November 1962", short: true },
      { key: "description", label: "Description", hint: "What happened?", compact: true },
      { key: "causes", label: "Causes", hint: "What led to it?" },
      { key: "consequences", label: "Consequences", hint: "What changed because of it?", compact: true },
      {
        key: "legacy_effects",
        label: "Legacy",
        hint: "How is it remembered, or felt, in the story's present?",
      },
    ],
  },
  calendar: {
    label: "Calendar",
    plural: "Calendars",
    fields: [
      { key: "epoch_name", label: "Epoch", hint: "What years are counted from…", short: true },
      { key: "description", label: "Description", hint: "Who keeps this calendar, and why?" },
      { key: "conversion_notes", label: "Conversion notes", hint: "How it maps onto another calendar…" },
    ],
  },
  travel: {
    label: "Route",
    plural: "Routes",
    fields: [
      { key: "travel_time", label: "Time", hint: "e.g. 20 minutes", short: true },
      { key: "travel_method", label: "Method", hint: "On foot, by ferry…", short: true },
      { key: "condition", label: "Conditions", hint: "When is it passable, and when is it not?" },
      { key: "notes", label: "Notes", hint: "Anything else worth keeping…" },
    ],
  },
};

/** The fields a value is actually present for, and the rest (the Add row). */
export function splitFields(
  fields: FieldSpec[],
  values: Record<string, unknown>,
): { filled: FieldSpec[]; empty: FieldSpec[] } {
  const filled: FieldSpec[] = [];
  const empty: FieldSpec[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (typeof v === "string" ? v.trim() : v !== null && v !== undefined && v !== "") filled.push(f);
    else empty.push(f);
  }
  return { filled, empty };
}

/** A place's celestial fields only belong to celestial places, or ones already filled in. */
export function locationFields(locationType: string, values: Record<string, unknown>): FieldSpec[] {
  const celestial = CELESTIAL_TYPES.has(typeValue(locationType));
  const celestialKeys = new Set([
    "orbital_period",
    "distance_from_parent",
    "gravity",
    "habitability",
    "radiation_level",
  ]);
  return KINDS.location.fields.filter(
    (f) => !celestialKeys.has(f.key) || celestial || String(values[f.key] ?? "").trim(),
  );
}
