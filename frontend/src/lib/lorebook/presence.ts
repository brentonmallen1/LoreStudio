import type { StructureNode } from "../../types";
import type { SceneCast } from "../../types/panel";
import { sceneLeaves } from "../planning/methods";
import type { StoryStructureTemplate } from "../../types";

export type PresenceKind = "character" | "location" | "thread";

export interface SceneRef {
  id: string;
  title: string;
}

/**
 * The scenes an entity is in, in story order (doc 12 P2: the sheet's presence line and its
 * scene chips). Read from the scene cast the server computed, the same source as the strip's
 * colour modes, so the sheet and the strip never disagree about who is where.
 */
export function scenesWith(
  kind: PresenceKind,
  id: string,
  cast: SceneCast | null,
  structure: StructureNode[],
  template: StoryStructureTemplate | null,
): SceneRef[] {
  if (!cast) return [];
  const byId = new Map(cast.scenes.map((s) => [s.node_id, s]));
  const out: SceneRef[] = [];
  for (const scene of sceneLeaves(structure, template)) {
    const entry = byId.get(scene.id);
    if (!entry) continue;
    const ids =
      kind === "character"
        ? entry.character_ids
        : kind === "location"
          ? entry.location_ids
          : entry.thread_ids;
    if (ids.includes(id)) out.push({ id: scene.id, title: scene.title || "Untitled scene" });
  }
  return out;
}

/** "On the page in 9 of 12 scenes · last in The Departure", or the quiet version for none. */
export function presenceLine(scenes: SceneRef[], total: number, noun = "On the page"): string {
  if (scenes.length === 0) return total > 0 ? "Not on the page yet" : "";
  const last = scenes[scenes.length - 1];
  const first = scenes[0];
  if (scenes.length === 1) return `${noun} in ${first.title}`;
  return `${noun} in ${scenes.length} of ${total} scenes · first in ${first.title}, last in ${last.title}`;
}
