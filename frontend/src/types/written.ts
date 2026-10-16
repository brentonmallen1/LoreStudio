import type { StructureNode } from "./index";

/** What you've written (doc 29 D6): the Overview's discovery section, read from the prose. */
export interface NamedCount {
  id: string;
  name: string;
  /** Times the prose names them, by any of their names. */
  times: number;
  /** Scenes they are in: named, seen through, or placed there. */
  scenes: number;
  color_slot: number | null;
}

/** A name the prose uses that the Lorebook lacks, from Discoveries' name scan. */
export interface NewName {
  proposal_id: string;
  kind: "person" | "place";
  name: string;
  times: number;
  /** The Discoveries proposal's own "yes". */
  add_action: string;
}

export interface SplitOffer {
  node_id: string;
  title: string;
  words: number;
  jumps: { phrase: string; passage: string }[];
  /** The rule it was found by: scenes of this many words or more. */
  long_scene_words: number;
}

export interface ChaptersOffer {
  part_id: string;
  title: string;
  scenes: number;
  /** What the new parts would be called ("chapter"), from the story's shape. */
  level: string;
  /** The rule: a part holding this many scenes or more. */
  many_scenes: number;
}

export interface WrittenOut {
  people: NamedCount[];
  places: NamedCount[];
  new_names: NewName[];
  last_scan: string | null;
  split_offers: SplitOffer[];
  chapters_offers: ChaptersOffer[];
}

/** A scene as the structure listing sends it: with its first line when it has no line of its own. */
export type ListedNode = StructureNode & { first_line?: string };
