/** The findings feed (doc 12 P3/P4): mirrors `backend/app/schemas/findings.py`. */

export type FindingKind = "prose" | "continuity" | "structure" | "cast" | "meaning";
export type FindingSeverity = "high" | "mid" | "low";
export type FindingSource = "local" | "ai" | "data";
/** What the row's verb does. `open_sheet` with no anchor opens Story Identity. */
export type FindingAction = "open_scene" | "open_sheet" | "open_chapter" | "ask" | "fix";

export interface FindingAnchor {
  node_id: string | null;
  character_id: string | null;
  location_id: string | null;
  thread_id: string | null;
  twist_id: string | null;
  /** A series element: the same finding stands in every book of its series. */
  series_element_id?: string | null;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: FindingSeverity;
  source: FindingSource;
  check: string;
  text: string;
  evidence: string;
  suggestion: string;
  where: string;
  anchor: FindingAnchor;
  action: FindingAction;
  /** A misspelt name to rename, (series) this book's value to make every book's, or (carry)
   * a thread left open brought into the next book. */
  fix:
    | { kind: "rename"; old: string; new: string }
    | { kind: "series"; old: string; new: string; field: string; element_id: string }
    | { kind: "carry"; old: string; new: string; story_id: string }
    | null;
  run_id: string | null;
  feature: string | null;
  created_at: string | null;
}

export interface FindingsOut {
  findings: Finding[];
  counts_by_kind: Partial<Record<FindingKind, number>>;
  open_count: number;
  dismissed_count: number;
  last_local_run: string | null;
  last_ai_run_by_feature: Record<string, string>;
  sizing: { has_chapters: boolean; has_target: boolean; written_scenes: number };
}
