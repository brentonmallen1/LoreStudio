import {
  Flag,
  BookMarked,
  Clapperboard,
  Layers,
  Zap,
  Puzzle,
  Milestone,
  type LucideIcon,
} from "lucide-react";
import type { StructureNode } from "../../types";

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  act: Flag,
  chapter: BookMarked,
  scene: Clapperboard,
  section: Layers,
  beat: Zap,
  part: Puzzle,
  stage: Milestone,
};

export function getSegmentIcon(levelType: string): LucideIcon {
  return SEGMENT_ICONS[levelType.toLowerCase()] ?? Layers;
}

export function segmentColor(levelType: string): string {
  const key = levelType.toLowerCase();
  const known = ["act", "chapter", "scene", "section", "beat", "part", "stage"];
  // Blend 65% segment color with 35% muted text — keeps types distinct without full-saturation rainbow
  return known.includes(key)
    ? `color-mix(in srgb, var(--segment-${key}) 65%, var(--color-text-subtle))`
    : "var(--color-text-subtle)";
}

// ── Reorder helpers ────────────────────────────────────────────────────────────

export function reorderInTree(
  nodes: StructureNode[],
  draggedId: string,
  targetId: string,
  zone: "above" | "below" | "into",
): StructureNode[] {
  // Extract dragged node from anywhere in the tree
  let dragged: StructureNode | null = null;

  function extract(list: StructureNode[]): StructureNode[] {
    return list.flatMap((n) => {
      if (n.id === draggedId) {
        dragged = n;
        return [];
      }
      return [{ ...n, children: extract(n.children ?? []) }];
    });
  }

  function insert(list: StructureNode[]): StructureNode[] {
    if (zone === "into") {
      return list.map((n) => {
        if (n.id === targetId) {
          return { ...n, children: [...(n.children ?? []), dragged!] };
        }
        return { ...n, children: insert(n.children ?? []) };
      });
    }
    // above / below: find target in this list, insert dragged next to it
    const idx = list.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      const copy = [...list];
      copy.splice(zone === "above" ? idx : idx + 1, 0, dragged!);
      return copy;
    }
    return list.map((n) => ({ ...n, children: insert(n.children ?? []) }));
  }

  const withoutDragged = extract(nodes);
  if (!dragged) return nodes; // dragged id not found, bail
  return insert(withoutDragged);
}

export function flattenPositions(nodes: StructureNode[], parentId: string | null = null) {
  const ops: { node_id: string; parent_id: string | null; position: number }[] = [];
  nodes.forEach((n, i) => {
    ops.push({ node_id: n.id, parent_id: parentId, position: i });
    ops.push(...flattenPositions(n.children ?? [], n.id));
  });
  return ops;
}

export function findNode(nodes: StructureNode[], id: string): StructureNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

// ── NodeItem ──────────────────────────────────────────────────────────────────

// ── Expansion state, remembered per story ─────────────────────────────────────

function collapsedKey(storyId: string | undefined) {
  return `ls_tree_collapsed_${storyId ?? "none"}`;
}

export function loadCollapsed(storyId: string | undefined): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(collapsedKey(storyId)) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function saveCollapsed(storyId: string | undefined, ids: Set<string>) {
  try {
    localStorage.setItem(collapsedKey(storyId), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}

/** Depth-first list of visible rows, used for arrow-key navigation. */
export function visibleIds(nodes: StructureNode[], collapsed: Set<string>): string[] {
  const out: string[] = [];
  const walk = (n: StructureNode) => {
    out.push(n.id);
    if (!collapsed.has(n.id)) (n.children ?? []).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/**
 * Where a new node at `level` goes: the selected node when it sits one level up, the
 * selected node's ancestor at that level when the selection is deeper, or else the last
 * node at that level. Null when the story has nothing at that level to hold it.
 *
 * "Add Chapter" used to be disabled until an act was selected, so adding the first
 * chapter took a detour through the tree.
 */
export function parentForLevel(
  nodes: StructureNode[],
  level: number,
  selected: StructureNode | null,
): StructureNode | null {
  if (level === 0) return null;
  const want = level - 1;
  if (selected) {
    let at: StructureNode | undefined = findNode(nodes, selected.id) ?? selected;
    while (at && at.level > want) at = at.parent_id ? findNode(nodes, at.parent_id) : undefined;
    if (at && at.level === want) return at;
  }
  let last: StructureNode | null = null;
  const walk = (list: StructureNode[]) => {
    for (const n of list) {
      if (n.level === want) last = n;
      walk(n.children ?? []);
    }
  };
  walk(nodes);
  return last;
}

/** The ancestors of a node, root first, then the node. */
export function pathTo(
  nodes: StructureNode[],
  id: string,
  trail: StructureNode[] = [],
): StructureNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...trail, n];
    const hit = pathTo(n.children ?? [], id, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}
