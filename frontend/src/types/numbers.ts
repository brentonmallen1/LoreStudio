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
