import type { StructureNode } from "../../types";
import type { Finding, FindingKind, FindingSeverity } from "../../types/findings";

/**
 * How the findings page arranges the feed (doc 12 P4). By place: one group per scene or
 * chapter in reading order, then one per character, place, thread or twist, then the
 * story as a whole. By urgency: three buckets. Within a group, the worst first.
 */

export type GroupBy = "place" | "urgency";

export interface FindingGroup {
  id: string;
  label: string;
  /** The chapter a scene sits in, or what kind of entry an entity group is. */
  sub: string;
  findings: Finding[];
}

export const KIND_LABELS: Record<FindingKind, string> = {
  prose: "Prose",
  continuity: "Continuity",
  structure: "Structure",
  cast: "Cast",
  meaning: "Meaning",
};

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  high: "Look at these first",
  mid: "Worth a look",
  low: "Small things",
};

const SEVERITY_RANK: Record<FindingSeverity, number> = { high: 0, mid: 1, low: 2 };

export function bySeverity(a: Finding, b: Finding): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.text.localeCompare(b.text);
}

/** Every node depth first in reading order, with its parent's title. */
function readingOrder(nodes: StructureNode[]): { node: StructureNode; parent: string }[] {
  const out: { node: StructureNode; parent: string }[] = [];
  const walk = (list: StructureNode[], parent: string) => {
    for (const n of [...list].sort((a, b) => a.position - b.position)) {
      out.push({ node: n, parent });
      if (n.children?.length) walk(n.children, n.title || "");
    }
  };
  walk(nodes, "");
  return out;
}

const ENTITY_KEYS = [
  ["character_id", "Character"],
  ["location_id", "Place"],
  ["thread_id", "Plot thread"],
  ["twist_id", "Twist"],
] as const;

function entityKey(f: Finding): { id: string; sub: string } | null {
  for (const [key, sub] of ENTITY_KEYS) {
    const id = f.anchor[key];
    if (id) return { id: `${key}:${id}`, sub };
  }
  return null;
}

export function groupByPlace(findings: Finding[], structure: StructureNode[]): FindingGroup[] {
  const order = readingOrder(structure);
  const position = new Map(order.map((o, i) => [o.node.id, i]));
  const groups = new Map<string, FindingGroup & { rank: number }>();
  const add = (id: string, label: string, sub: string, rank: number, f: Finding) => {
    const g = groups.get(id) ?? { id, label, sub, findings: [], rank };
    g.findings.push(f);
    groups.set(id, g);
  };
  const entityRank = order.length;
  for (const f of findings) {
    const nodeId = f.anchor.node_id;
    const at = nodeId ? position.get(nodeId) : undefined;
    if (nodeId && at !== undefined) {
      const { node, parent } = order[at];
      add(nodeId, node.title || "Untitled", parent, at, f);
      continue;
    }
    const entity = entityKey(f);
    if (entity) add(entity.id, f.where || entity.sub, entity.sub, entityRank, f);
    else add("story", "The whole story", "", entityRank + 1, f);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ rank: _rank, ...g }) => ({ ...g, findings: [...g.findings].sort(bySeverity) }));
}

export function groupByUrgency(findings: Finding[]): FindingGroup[] {
  return (["high", "mid", "low"] as const)
    .map((sev) => ({
      id: sev,
      label: SEVERITY_LABELS[sev],
      sub: "",
      findings: findings.filter((f) => f.severity === sev),
    }))
    .filter((g) => g.findings.length > 0);
}

/** The findings about one scene, for the This scene tab. */
export function findingsForNode(findings: Finding[], nodeId: string | null | undefined): Finding[] {
  return nodeId ? findings.filter((f) => f.anchor.node_id === nodeId).sort(bySeverity) : [];
}

/** The findings about one Lorebook entry, for its sheet's Health card. */
export function findingsForEntity(
  findings: Finding[],
  key: (typeof ENTITY_KEYS)[number][0],
  id: string,
): Finding[] {
  return findings.filter((f) => f.anchor[key] === id).sort(bySeverity);
}
