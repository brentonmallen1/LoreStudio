import type { Character, Location, PlotThread, StructureNode } from "../../types";
import type { MentionedRef, MentionKind } from "../../types/mentions";

/**
 * @-mentions in a chat composer (refactor doc 11, phase 6). Pure: given the text and the
 * caret, is the author typing a mention, and what could it be? The composer draws the
 * popover; this decides what is in it.
 */
export interface ActiveMention {
  /** Index of the `@`. */
  start: number;
  /** What has been typed after it. */
  query: string;
}

const MAX_QUERY = 30;

/** The mention being typed at the caret, if the `@` starts a word and the query is short. */
export function activeMention(text: string, caret: number): ActiveMention | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY || query.includes("\n")) return null;
  return { start: at, query };
}

export interface Candidate extends MentionedRef {
  kind: MentionKind;
}

export interface CandidatePool {
  characters: Character[];
  locations: Location[];
  scenes: StructureNode[];
  threads: PlotThread[];
}

function score(label: string, q: string): number {
  const l = label.toLowerCase();
  if (!q) return 1;
  if (l.startsWith(q)) return 3;
  if (l.split(/[\s’']+/).some((w) => w.startsWith(q))) return 2;
  if (l.includes(q)) return 1;
  return 0;
}

/** What the query could mean, best first, leaving out what is already mentioned. */
export function candidates(
  query: string,
  pool: CandidatePool,
  already: MentionedRef[] = [],
  limit = 6,
): Candidate[] {
  const q = query.trim().toLowerCase();
  const taken = new Set(already.map((r) => `${r.kind}:${r.id}`));
  const all: Candidate[] = [
    ...pool.characters.map((c) => ({ kind: "character" as const, id: c.id, label: c.name })),
    ...pool.locations.map((l) => ({ kind: "location" as const, id: l.id, label: l.name })),
    ...pool.scenes.map((s) => ({ kind: "scene" as const, id: s.id, label: s.title })),
    ...pool.threads.map((t) => ({ kind: "thread" as const, id: t.id, label: t.name })),
  ];
  return all
    .filter((c) => !taken.has(`${c.kind}:${c.id}`))
    .map((c) => ({ c, s: score(c.label, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/** The text with the typed mention replaced by the chosen name, and where the caret lands. */
export function acceptMention(text: string, caret: number, mention: ActiveMention, label: string) {
  const rest = text.slice(caret);
  const gap = /^\s/.test(rest) ? "" : " ";
  const next = `${text.slice(0, mention.start)}@${label}${gap}${rest}`;
  return { text: next, caret: mention.start + label.length + 1 + gap.length };
}
