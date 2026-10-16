import type { ListedNode } from "../../types/written";
import type { StructureNode } from "../../types";

/** Marks a line taken from the prose rather than written by the writer (doc 29 D6). */
export const FROM_FIRST_LINE = "from the first line";

/**
 * A scene's line of what happens, as the Outline and What you've written show it: the writer's
 * own line when there is one, or else the scene's first sentence, which the server reads from the
 * prose with the shared prose helpers and marks "from the first line" until a line is written.
 */
export function sceneLine(node: StructureNode): { text: string; fromFirstLine: boolean } {
  const own = node.synopsis?.trim() ?? "";
  if (own) return { text: own, fromFirstLine: false };
  const first = (node as ListedNode).first_line?.trim() ?? "";
  return { text: first, fromFirstLine: !!first };
}
