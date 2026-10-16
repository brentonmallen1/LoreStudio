import type { StructureNode } from "../../types";

export const STATUS_WORDS: Record<string, string> = {
  planned: "Planned, no words yet",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

/** A scene's status as the Outline shows it: a scene with no words is planned (the dashed
 *  mark, doc 29 D2), whatever it says; one with words is at least a draft. */
export function sceneStatus(node: Pick<StructureNode, "status" | "word_count">): string {
  if (!node.word_count) return "planned";
  return node.status === "planned" ? "draft" : node.status;
}

/** "Draft, 1,840 words", or "Planned, no words yet". */
export function statusWords(node: Pick<StructureNode, "status" | "word_count">): string {
  const status = sceneStatus(node);
  if (status === "planned") return STATUS_WORDS.planned;
  const words = node.word_count.toLocaleString();
  return `${STATUS_WORDS[status] ?? status}, ${words} ${node.word_count === 1 ? "word" : "words"}`;
}
