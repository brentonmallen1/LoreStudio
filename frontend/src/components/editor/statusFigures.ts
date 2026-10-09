import type { StructureNode } from "../../types";
import { WORD_COUNT_RANGES } from "../../utils/wordCount";
import type { SaveState } from "./useSceneAutosave";

/**
 * What the status corner says (doc 24 D6): the save light, and the figures its popover
 * opens on. Pure, so the light's colours and the sums are tested without an editor.
 */

export type Led = "ok" | "busy" | "trouble";

/** Green for saved, yellow for unsaved or saving, red for offline or a conflict. */
export function ledFor(state: SaveState): { led: Led; label: string } {
  switch (state) {
    case "unsaved":
      return { led: "busy", label: "Unsaved changes, saving in a moment" };
    case "saving":
      return { led: "busy", label: "Saving…" };
    case "offline":
      return {
        led: "trouble",
        label: "Offline. Your text is kept here and the save will be tried again",
      };
    case "conflict":
      return { led: "trouble", label: "This scene changed elsewhere. Choose which version to keep" };
    default:
      return { led: "ok", label: "Saved" };
  }
}

export interface Figures {
  scene: number;
  /** The scene's parent (a chapter, an act) and its words, when it has one. */
  parent: { node: StructureNode; words: number } | null;
  book: number;
}

/** The words under a node: a leaf's own count, a container's its children's. The open
 *  scene counts as the editor has it, not as last saved. */
function wordsIn(node: StructureNode, openId: string, live: number): number {
  if (node.id === openId) return live;
  const kids = node.children ?? [];
  return kids.length ? kids.reduce((n, c) => n + wordsIn(c, openId, live), 0) : (node.word_count ?? 0);
}

export function statusFigures(structure: StructureNode[], openId: string, live: number): Figures {
  const book = structure.reduce((n, c) => n + wordsIn(c, openId, live), 0);
  let parent: Figures["parent"] = null;
  const find = (nodes: StructureNode[], above: StructureNode | null): boolean =>
    nodes.some((n) => {
      if (n.id === openId) {
        if (above) parent = { node: above, words: wordsIn(above, openId, live) };
        return true;
      }
      return find(n.children ?? [], n);
    });
  find(structure, null);
  return { scene: live, parent, book };
}

/** The upper end of the story's intended form (a novelette is 17,500), or none. */
export function goalFor(intendedLength: string | null | undefined): number | null {
  return (intendedLength && WORD_COUNT_RANGES[intendedLength]?.max) || null;
}
