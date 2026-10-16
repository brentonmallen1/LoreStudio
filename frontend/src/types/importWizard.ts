import type { ExtractionCandidate } from "./index";
import type { NovelcrafterChoices, NovelcrafterPreview } from "./novelcrafter";

// ---------------------------------------------------------------------------
// Document Import Wizard
// ---------------------------------------------------------------------------

export interface ImportPreviewNode {
  id: string;
  parent_id: string | null;
  title: string;
  level: number;
  level_type: string;
  content_preview: string;
  word_count: number;
  source: "heuristic" | "ai" | "user";
  confidence: number;
  needs_review: boolean;
  paragraph_start: number;
  paragraph_end: number;
}

export interface ImportPreviewTree {
  session_id: string;
  source_format: string;
  detected_title: string | null;
  template_id: string;
  template_levels: { name: string; plural: string }[];
  nodes: ImportPreviewNode[];
  warnings: string[];
  total_word_count: number;
  /** How many edits Review structure can take back (each rename, merge, level, Auto-segment). */
  undo_depth?: number;
}

export interface ImportUploadResponse {
  session_id: string;
  source_format: string;
  detected_title: string | null;
  preview: ImportPreviewTree;
  has_unstructured_blocks: boolean;
  ai_available: boolean;
  novelcrafter?: NovelcrafterPreview | null;
}

export interface ImportAIAnalyzeResponse {
  preview: ImportPreviewTree;
  suggestions_applied: number;
  reasoning: string;
}

export interface ImportNodeAdjustment {
  action: "rename" | "merge_up" | "relevel";
  node_id: string;
  new_title?: string;
  new_level?: number;
}

export interface ImportFinalizeRequest {
  title: string;
  description: string;
  template_id: string;
  genre: string;
  extraction_candidate_ids?: string[];
  extraction_candidates?: ExtractionCandidate[];
  novelcrafter?: NovelcrafterChoices;
}
