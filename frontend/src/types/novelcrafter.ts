/** A Novelcrafter export in the import wizard, and the import's record (doc 28). Mirrors
 *  `backend/app/schemas/import_novelcrafter.py` and `services/import_records.py`. */

export type EntryTarget =
  | "character"
  | "location"
  | "thread"
  | "trope"
  | "theme"
  | "world_system"
  | "culture"
  | "historical_event"
  | "compendium"
  | "note"
  | "facet"
  | "merge"
  | "later"
  | "skip";
export type FacetField =
  "appearance" | "speech_patterns" | "thinking" | "background" | "personality" | "note";
export type SnippetTarget = "note" | "compendium" | "logline" | "later" | "skip";

export interface NcEntry {
  id: string;
  origin: string;
  type: string;
  name: string;
  aliases: string[];
  tags: string[];
  excerpt: string;
  has_notes: boolean;
  has_thumbnail: boolean;
  urls: number;
  target: EntryTarget;
  facet_of: string | null;
  facet_field: FacetField | null;
  clash_with: string | null;
  clash_text: string;
}

export interface NcSnippet {
  id: string;
  origin: string;
  title: string;
  excerpt: string;
  target: SnippetTarget;
}

export interface NcChat {
  id: string;
  origin: string;
  title: string;
  date: string;
  turns: number;
}

export interface LeftOut {
  what: string;
  why: string;
  count: number;
  examples: string[];
}

export interface NovelcrafterPreview {
  entries: NcEntry[];
  snippets: NcSnippet[];
  chats: NcChat[];
  no_place: LeftOut[];
  nothing_set: string[];
  not_in_file: string[];
  author: string | null;
  looks_like_screenplay: boolean;
}

export interface NcEntryChoice {
  target: EntryTarget;
  facet_of?: string | null;
  facet_field?: FacetField | null;
  merge_into?: string | null;
}

export interface NovelcrafterChoices {
  entries: Record<string, NcEntryChoice>;
  snippets: Record<string, SnippetTarget>;
  chats: boolean;
  screenplay: boolean;
}

/** One import's report (`GET /stories/{id}/imports/{record}`). */
export interface ImportReport {
  id: string;
  story_id: string;
  source: "novelcrafter" | "document" | "script";
  filename: string;
  imported_at: string;
  scenes: number;
  came_over: Record<string, number>;
  waiting: number;
  placed: number;
  declined: number;
  skipped: string[];
  left_out: LeftOut[];
  nothing_set: string[];
  not_in_file: string[];
  original: { asset_id: string; filename: string; size_bytes: number } | null;
  manifest?: { origin: string; name: string; became_type: string; became_id: string | null }[];
  items?: {
    id: string;
    name: string;
    origin_type: string;
    status: "waiting" | "placed" | "declined";
    became_type: string | null;
    became_id: string | null;
  }[];
}
