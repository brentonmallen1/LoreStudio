/** GET /stories/{id}/promises (doc 18 C2): every promise the story makes, in reading order. */
import type { ThreadRole, ThreadStatus, TwistStatus, TwistType, ClueTarget, SubtletyLevel } from "./index";

export interface PromiseScene {
  id: string;
  title: string;
  index: number;
  chapter_id: string | null;
  /** Has prose; a scene with none is planned. */
  written: boolean;
}

export interface PromiseChapter {
  id: string;
  title: string;
  first: number;
  count: number;
}

export interface ThreadBeat {
  node_id: string;
  index: number;
  role: ThreadRole;
  note: string;
}

export interface PromiseThread {
  id: string;
  name: string;
  description: string;
  color_slot: number;
  mice_type: string | null;
  status: ThreadStatus;
  beats: ThreadBeat[];
}

export interface PromiseClue {
  id: string;
  node_id: string | null;
  /** The scene's place in the book; null for a clue not placed yet. */
  index: number | null;
  text: string;
  points_to: ClueTarget;
  subtlety: SubtletyLevel;
  quote: string;
}

export interface PromiseTwist {
  id: string;
  name: string;
  color_slot: number;
  status: TwistStatus;
  twist_type: TwistType;
  the_truth: string;
  the_misdirection: string;
  reveal_node_id: string | null;
  reveal_index: number | null;
  clues: PromiseClue[];
}

/** A scene link, earlier scene first. */
export interface Setup {
  id: string;
  link_type: string;
  from_node_id: string;
  to_node_id: string;
  from_index: number;
  to_index: number;
  note: string;
}

export interface ReaderItem {
  text: string;
  source: "clue" | "reveal" | "you";
  twist_id: string | null;
  event_id: string | null;
  /** A belief the story has since overturned. */
  over: boolean;
}

export interface ReaderRow {
  node_id: string;
  index: number;
  learns: ReaderItem[];
  believes: ReaderItem[];
  only: ReaderItem[];
}

export interface PromiseCheck {
  check: string;
  severity: "low" | "medium" | "high";
  text: string;
  suggestion: string;
  thread_id: string | null;
  twist_id: string | null;
  node_id: string | null;
}

export interface Promises {
  scenes: PromiseScene[];
  chapters: PromiseChapter[];
  threads: PromiseThread[];
  twists: PromiseTwist[];
  setups: Setup[];
  reader: ReaderRow[];
  checks: PromiseCheck[];
}
