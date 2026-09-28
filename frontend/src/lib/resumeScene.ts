import type { StructureNode } from "../types";
import { serverTime } from "./serverDate";

/**
 * Which scene the Write page opens.
 *
 * It used to open on "Pick a section in the structure tree" every time, even though the
 * Overview could say "Last worked on The Logbook". Now, in order: a scene the link names
 * (`?node=`, used after creating a story), the scene last open in this story on this
 * browser, or the scene edited most recently.
 */

const KEY = (storyId: string) => `ls_last_node:${storyId}`;

export function rememberScene(storyId: string, nodeId: string): void {
  try {
    localStorage.setItem(KEY(storyId), nodeId);
  } catch {
    // Storage can be refused (private windows); resuming then falls back to recency.
  }
}

function remembered(storyId: string): string | null {
  try {
    return localStorage.getItem(KEY(storyId));
  } catch {
    return null;
  }
}

function walk(nodes: StructureNode[], out: StructureNode[] = []): StructureNode[] {
  for (const n of nodes) {
    out.push(n);
    walk(n.children ?? [], out);
  }
  return out;
}

/** The node to open, or null when the story has no nodes at all. */
export function sceneToResume(
  storyId: string,
  structure: StructureNode[],
  requested: string | null,
  lastOpen: string | null = remembered(storyId),
): StructureNode | null {
  const all = walk(structure);
  const byId = (id: string | null) => (id ? all.find((n) => n.id === id) : undefined);
  const named = byId(requested) ?? byId(lastOpen);
  if (named) return named;
  // A leaf is something you write in; a chapter holding scenes is not.
  const leaves = all.filter((n) => !n.children?.length);
  if (leaves.length === 0) return null;
  return leaves.reduce((best, n) => (serverTime(n.updated_at) > serverTime(best.updated_at) ? n : best));
}
