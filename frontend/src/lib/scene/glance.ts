import type { StructureNode } from "../../types";

/**
 * The scene at a glance (doc 24 D19): the panel's This scene tab says each part of a scene
 * in a line and sends the rest to the Scene sheet, the page with every field on it.
 */

/** The Scene sheet: every field of one scene, editable, on a page (doc 24 D19). */
export function sceneSheetPath(storyId: string, nodeId: string): string {
  return `/stories/${storyId}/write/${nodeId}/sheet`;
}

export interface Present {
  id: string;
  name: string;
  pov: boolean;
}

/**
 * Who is in the scene: the point of view first, then everyone else the cast reading found,
 * in its order. A point of view the reading missed (a planned scene has no prose) still leads.
 */
export function whoIsHere(
  povId: string | null | undefined,
  castIds: string[],
  characters: { id: string; name: string }[],
): Present[] {
  const byId = new Map(characters.map((c) => [c.id, c]));
  const ids = povId && byId.has(povId) ? [povId, ...castIds.filter((id) => id !== povId)] : castIds;
  return [...new Set(ids)].flatMap((id) => {
    const c = byId.get(id);
    return c ? [{ id, name: c.name, pov: id === povId }] : [];
  });
}

/**
 * A neighbour in one line: where the scene before leaves things, or where the scene after
 * picks up. The planned state first, then what happens in it, then the summary of its prose.
 */
export function neighbourLine(node: StructureNode, side: "before" | "after"): string | null {
  const state = side === "before" ? node.exit_state : node.entry_state;
  for (const text of [state, node.synopsis, node.content_summary]) {
    if (text && text.trim()) return text.trim();
  }
  return null;
}
