/** Tropes in play (doc 27): what the author does with a trope, and where it plays. */

export type TropeStance =
  "undecided" | "straight" | "subverted" | "inverted" | "averted" | "deconstructed" | "lampshaded";

/** Where a trope plays: one of a character, a relationship between two, or a scene. */
export interface TropeLink {
  id: string;
  trope_id: string;
  character_id: string | null;
  relationship_id: string | null;
  node_id: string | null;
  note: string;
  created_at: string;
}

export interface Trope {
  id: string;
  story_id: string;
  name: string;
  stance: TropeStance;
  why: string;
  /** The thread that tracks the expectation it sets up; null when gone or never set. */
  thread_id: string | null;
  /** The Compendium entry holding the definition. */
  definition_id: string | null;
  position: number;
  /** None: the trope applies to the whole story. */
  links: TropeLink[];
  created_at: string;
  updated_at: string;
}

export type TropeLinkTarget = { character_id: string } | { relationship_id: string } | { node_id: string };
