/** Types for the side panel and the story strip (refactor doc 11). */

/** One scene's signals from `GET /stories/{id}/scene-cast`. */
export interface SceneCastEntry {
  node_id: string;
  /** Point of view first, then by how often the prose names them. */
  character_ids: string[];
  location_ids: string[];
  thread_ids: string[];
  beat_id: string | null;
  status: string;
  word_count: number;
  /** The first words of the prose, plain text. */
  opening: string;
}

export interface SceneCast {
  scenes: SceneCastEntry[];
}

export type EntityKind = "character" | "location" | "thread" | "twist" | "compendium";

export type ToolId = "characters" | "places" | "threads" | "freewrite" | "notes";

export type PanelTab =
  | { id: "scene"; kind: "scene" }
  | { id: string; kind: "entity"; entityKind: EntityKind; entityId: string; label: string }
  | { id: string; kind: "tool"; tool: ToolId };

export const TOOL_LABELS: Record<ToolId, string> = {
  characters: "Characters",
  places: "Places",
  threads: "Threads",
  freewrite: "Freewrite",
  notes: "Notes",
};

export function entityTabId(kind: EntityKind, id: string): string {
  return `entity:${kind}:${id}`;
}

export function toolTabId(tool: ToolId): string {
  return `tool:${tool}`;
}
