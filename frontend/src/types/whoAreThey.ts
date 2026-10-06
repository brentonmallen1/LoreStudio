/**
 * Who are they (doc 20): what a character's sheet holds about who a person is. Every field is
 * optional and free text in the author's words; only an entry's area and who knows it are fixed
 * sets (backend/app/schemas/who_they_are.py).
 */

/** Body and mind areas (P4), in the order the sheet shows them. */
export type FacetArea =
  "moving" | "senses" | "communicating" | "health" | "neurodivergence" | "mental_health" | "other";

/** Who in the story knows: everyone, some (named), or only them. */
export type Known = "everyone" | "some" | "only_them";

interface Entry {
  id: string;
  /** What it does to them: in how they think, what they do, how they are with people. */
  impact: string;
  /** How it shows on the page. */
  page: string;
  known: Known;
  known_to: string[];
  known_note: string;
  /** The scene where the reader learns it. */
  revealed_in: string | null;
  /** False keeps it out of every prompt (Studio only). */
  assistant: boolean;
}

/** One Body and mind entry: a disability, a condition, a way of being. */
export interface Facet extends Entry {
  area: FacetArea;
  name: string;
  since: string;
  /** How it shapes their days. */
  days: string;
  /** What they'd want understood. */
  understood: string;
  /** Compendium entries that inform it. */
  research: string[];
}

/** One formative experience: what happened, what it did, how it shows. */
export interface Formative extends Entry {
  title: string;
  when: string;
  what: string;
  /** The experience behind the arc. */
  wound: boolean;
  /** Content notes, for the author only. */
  notes: string[];
}

/** The fields a Character gains (P1, P2, P5). */
export interface WhoAreThey {
  gender: string;
  presentation: string;
  sex: string;
  age: string;
  orientation: string;
  languages: string;
  heritage: string;
  faith: string;
  family: string;
  circumstances: string;
  thinking: string;
  need: string;
  lie: string;
  stakes: string;
  sore_spots: string;
  takes_personally: string;
  shows_hurt: string;
  copes: string;
  holds_on: string;
  facets: Facet[];
  formative: Formative[];
}
