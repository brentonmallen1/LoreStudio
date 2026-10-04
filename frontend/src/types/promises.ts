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

/** A scene of another book of the series, by its place in the series (from 0). */
export interface BookScene {
  position: number;
  story_id: string;
  node_id: string | null;
  title: string;
}

/** What one book does with a thread or twist: the Across the series fold. */
export interface BookStep {
  position: number;
  story_id: string;
  ref_id: string;
  roles: ThreadRole[];
  toward: number;
  away: number;
  reveal: string | null;
  set_aside: boolean;
  first: string;
  last: string;
}

/** A thread or twist the series shares: where it stands across the books. */
export interface PromiseAcross {
  element_id: string;
  /** The earliest earlier book with scenes for it. */
  from_book: number | null;
  /** Still open after this book, and a later book has it. */
  continues_in: number | null;
  resolved_in: BookScene | null;
  revealed_in: BookScene | null;
  books: BookStep[];
}

export interface ComingInItem {
  text: string;
  source: "clue" | "reveal" | "you";
  /** The book it came from (from 0). */
  book: number;
  /** This book's own twist it belongs to, when it has it. */
  twist_id: string | null;
  /** A belief this book overturns: the scene that does it. */
  overturned_at: string | null;
}

/** What the reader knows at the start of this book, from the books before it. */
export interface ComingIn {
  learned: ComingInItem[];
  believes: ComingInItem[];
  only: ComingInItem[];
}

/** A thread or twist the earlier books left open. */
export interface EarlierOpen {
  kind: "thread" | "twist";
  element_id: string;
  name: string;
  ref_id: string | null;
  opened_book: number;
  last_book: number;
  last: string;
  truth: string;
  clues: string[];
}

/** A setup across books, seen from this book: its scene here, and the other book's. */
export interface SeriesSetup {
  id: string;
  link_type: string;
  note: string;
  /** "out": set up here, paid off later; "in": set up in an earlier book, paid off here. */
  direction: "out" | "in";
  node_id: string;
  index: number;
  other: BookScene;
}

export interface Promises {
  scenes: PromiseScene[];
  chapters: PromiseChapter[];
  threads: PromiseThread[];
  twists: PromiseTwist[];
  setups: Setup[];
  reader: ReaderRow[];
  checks: PromiseCheck[];
  /** In a series: this book's place in it (from 0), and the series. */
  book: number | null;
  series_id: string | null;
  /** Thread or twist id -> where it stands across the books. */
  across: Record<string, PromiseAcross>;
  coming_in: ComingIn | null;
  open_from_earlier: EarlierOpen[];
  series_setups: SeriesSetup[];
}
