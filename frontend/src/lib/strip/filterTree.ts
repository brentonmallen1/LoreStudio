import type { StructureNode } from "../../types";

/** Nodes whose title matches, or that hold one that does. */
export function filterTree(nodes: StructureNode[], q: string): StructureNode[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap((n) => {
    const kids = filterTree(n.children ?? [], q);
    return n.title.toLowerCase().includes(needle) || kids.length ? [{ ...n, children: kids }] : [];
  });
}
