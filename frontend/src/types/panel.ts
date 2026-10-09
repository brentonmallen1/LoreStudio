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

export type ToolId = "characters" | "places" | "threads" | "notes" | "freewrite" | "dialogue";

/**
 * What the rail launches (doc 24 D11): This scene, each tool and the Assistant. A launcher
 * shows in the panel without becoming a tab; the tab strip holds only what the author opened.
 */
export type Launcher = "scene" | "assistant" | ToolId;

/**
 * What the tab strip holds: a thing from the Lorebook, or a page beside the prose (doc 24
 * D2). A page tab keeps where the author is inside the page (`path`, after `/stories/:id`),
 * so a Lorebook tab moved on to Places comes back on Places.
 */
export type PanelTab =
  | { id: string; kind: "entity"; entityKind: EntityKind; entityId: string; label: string }
  | { id: string; kind: "page"; routeId: string; path: string };

export const TOOL_LABELS: Record<ToolId, string> = {
  characters: "Characters",
  places: "Places",
  threads: "Threads",
  notes: "Notes",
  freewrite: "Freewrite",
  dialogue: "Dialogue",
};

/** The tools down the rail, in order. */
export const TOOLS: ToolId[] = ["characters", "places", "threads", "notes", "freewrite", "dialogue"];

export function entityTabId(kind: EntityKind, id: string): string {
  return `entity:${kind}:${id}`;
}

export function pageTabId(routeId: string): string {
  return `page:${routeId}`;
}

/** What the panel shows for a launcher: "scene", "assistant" or "tool:<id>". */
export function launcherId(launcher: Launcher): string {
  return launcher === "scene" || launcher === "assistant" ? launcher : `tool:${launcher}`;
}

/** The launcher an id names, or null when it names a tab (or nothing known). */
export function launcherOf(id: string): Launcher | null {
  if (id === "scene" || id === "assistant") return id;
  if (!id.startsWith("tool:")) return null;
  const tool = id.slice(5);
  return (TOOLS as string[]).includes(tool) ? (tool as ToolId) : null;
}
