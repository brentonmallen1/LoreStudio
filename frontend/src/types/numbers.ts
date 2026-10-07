/** The story in numbers (doc 13 P3); mirrors backend/app/schemas/numbers.py. */
export interface NumbersWords {
  total: number;
  by_status: Record<string, number>;
  scenes: number;
  written_scenes: number;
  mean_per_scene: number;
  median_per_scene: number;
  form: string;
  target: {
    min: number | null;
    max: number;
    soft_warning_at: number | null;
    current: number;
    pct: number;
    warning_level: "normal" | "approaching" | "exceeded";
  } | null;
  reads_as: string | null;
}

export interface NumbersDialogue {
  total_lines: number;
  unattributed: number;
  balance: number | null;
  speakers: { speaker_name: string; character_id: string | null; line_count: number; word_count: number }[];
  pairs: { a_id: string; a_name: string; b_id: string; b_name: string; scene_count: number }[];
  monologue_scenes: { scene_id: string; scene_title: string; speaker: string; pct: number }[];
}

export interface NumbersProse {
  run_at: string;
  scenes: number;
  passive_pct: number;
  adverb_pct: number;
  mean_sentence: number;
  sentence_lengths: { label: string; count: number }[];
  by_scene: { scene_id: string; passive_pct: number; adverb_pct: number; mean_sentence: number }[];
}

export interface StoryNumbers {
  words: NumbersWords;
  dialogue: NumbersDialogue;
  prose: NumbersProse | null;
  summaries: NumbersSummaries;
}

/** The Assistant's scene summaries over the written scenes: current, out of date, not written. */
export interface NumbersSummaries {
  fresh: number;
  stale: number;
  missing: number;
}

/** A reading in the picker and the trend row (doc 19): when, why, and its headline figures. */
export interface ReadingSummary {
  id: string;
  taken_at: string;
  trigger: "session" | "daily" | "manual" | "snapshot" | "restore" | "backfill";
  /** The version's name, for a reading taken with a named snapshot. */
  label: string | null;
  snapshot_id: string | null;
  words: number;
  scenes: number;
  balance: number | null;
  passive_pct: number | null;
  open_findings: number | null;
}

export interface ReadingsList {
  readings: ReadingSummary[];
  unmeasured_versions: number;
}

/** A reading's figures (backend services/numbers_reading.py `measure`). */
export interface ReadingData {
  version: number;
  story_pov: string | null;
  words: NumbersWords;
  scenes: {
    id: string;
    title: string;
    parent_id: string | null;
    words: number;
    status: string;
    pov: string | null;
    beat_id: string | null;
    characters: string[];
    threads: { id: string; role: string; note: string }[];
  }[];
  chapters: { id: string; title: string }[];
  characters: { id: string; name: string; color_slot: number | null; arc: { done: number; total: number } }[];
  threads: { id: string; name: string; status: string; color_slot: number | null }[];
  beats: { id: string; name: string; at: number }[];
  dialogue: Pick<NumbersDialogue, "total_lines" | "unattributed" | "balance" | "speakers">;
  prose: (NumbersProse & { run_id: string }) | null;
  findings: Record<string, number> | null;
  summaries: NumbersSummaries;
}

export interface Reading {
  id: string;
  taken_at: string;
  trigger: ReadingSummary["trigger"];
  label: string | null;
  data: ReadingData;
}

/** Talking to each other (doc 20 P7): never a score or a pass. */
export interface TalkExchange {
  id: string;
  speakers: string[];
  lines: number;
  /** Studio: what it is about, in a few words, and whether that is a man in the story. */
  about?: string | null;
  about_a_man?: boolean | null;
}

export interface Talk {
  values: { value: string; count: number }[];
  group: string[];
  people: number;
  scenes: { node_id: string; title: string; exchanges: TalkExchange[] }[];
  scene_count: number;
  unattributed: number;
  described_at: string | null;
}
