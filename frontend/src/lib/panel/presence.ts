import type { Character, Location, PlotThread, StructureNode } from "../../types";
import type { EntityKind, SceneCast } from "../../types/panel";
import { presencePatterns, timesNamed } from "../prose/syntax";

/**
 * Whether an entity is on the open page, and where it was last seen if not (doc 11
 * phase 1). The page itself is read live, so a name typed a moment ago counts; the rest
 * of the book comes from the scene cast the server computed.
 */
export interface Presence {
  onPage: boolean;
  /** Times the page names them; 0 when not on the page. */
  count: number;
  /** The nearest scene they appear in, when not on the page: earlier if there is one, else later. */
  lastSeen: { nodeId: string; title: string; later?: boolean } | null;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Times a place is named: by its name or another, in any case, in [[ ]] or not. */
function countPlace(text: string, place: Location): number {
  const plain = text.replace(/<[^>]+>/g, " ");
  const patterns = [place.name, ...(place.aliases ?? [])]
    .filter((n) => n.trim())
    .sort((a, b) => b.length - a.length)
    .map((n) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, "giu"));
  return timesNamed(plain, patterns);
}

function inScene(kind: EntityKind, id: string, sceneId: string, cast: SceneCast | null): boolean {
  const entry = cast?.scenes.find((s) => s.node_id === sceneId);
  if (!entry) return false;
  if (kind === "character") return entry.character_ids.includes(id);
  if (kind === "location") return entry.location_ids.includes(id);
  if (kind === "thread") return entry.thread_ids.includes(id);
  return false;
}

function flatten(nodes: StructureNode[], out: StructureNode[] = []): StructureNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flatten(n.children, out);
  }
  return out;
}

export function entityPresence(
  kind: EntityKind,
  entity: Character | Location | PlotThread,
  node: StructureNode | null,
  structure: StructureNode[],
  cast: SceneCast | null,
  /** The rest of the cast, so a name two characters share counts for neither. */
  others: Character[] = [],
): Presence {
  const text = node ? `${node.content ?? ""} ${node.synopsis ?? ""}` : "";
  let count = 0;
  if (node) {
    if (kind === "character") {
      // By the server's presence rule, with the rest of the cast: a form two people share
      // ("Vance") names neither, and "Dr." alone is nobody (lib/prose/syntax).
      const c = entity as Character;
      const cast = [c, ...others.filter((o) => o.id !== c.id)];
      const patterns = presencePatterns(
        cast.map((p) => ({ kind: "character", name: p.name, aliases: p.aliases ?? [] })),
      );
      count = timesNamed(text.replace(/<[^>]+>/g, " "), patterns.get(c.name) ?? []);
    } else if (kind === "location") {
      count = countPlace(text, entity as Location);
    } else if (kind === "thread") {
      const t = entity as PlotThread;
      count = t.appearances?.some((a) => a.node_id === node.id) ? 1 : 0;
    }
  }
  if (count > 0) return { onPage: true, count, lastSeen: null };

  // Walk back from the open scene; before it, nothing has been "seen".
  const order = flatten(structure);
  const at = node ? order.findIndex((n) => n.id === node.id) : order.length;
  const before = at >= 0 ? order.slice(0, at) : order;
  for (let i = before.length - 1; i >= 0; i--) {
    if (inScene(kind, entity.id, before[i].id, cast)) {
      return { onPage: false, count: 0, lastSeen: { nodeId: before[i].id, title: before[i].title } };
    }
  }
  // Not earlier: the first later appearance still orients the reader.
  for (const n of order.slice(Math.max(at, 0) + 1)) {
    if (inScene(kind, entity.id, n.id, cast))
      return { onPage: false, count: 0, lastSeen: { nodeId: n.id, title: n.title, later: true } };
  }
  return { onPage: false, count: 0, lastSeen: null };
}

/** Plain-language line for the tab header. */
export function presenceLine(p: Presence): string {
  if (p.onPage) return p.count === 1 ? "On this page once." : `On this page ${p.count} times.`;
  if (p.lastSeen?.later) return `Not on this page yet. First appears in “${p.lastSeen.title}”.`;
  if (p.lastSeen) return `Not on this page. Last seen in “${p.lastSeen.title}”.`;
  return "Not on this page, or anywhere in the manuscript yet.";
}
