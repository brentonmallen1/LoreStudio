import type { ComponentType } from "react";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  /** Keywords for fuzzy matching beyond the label */
  keywords?: string[];
  icon: ComponentType<{ size?: number; className?: string }>;
  group: string;
  shortcut?: string;
  /** Show only when this returns true (evaluated at render time) */
  when?: () => boolean;
  /** Gray out when this returns false */
  enabled?: () => boolean;
  /** Dynamic child items — when present, selecting this action drills into the sub-menu */
  getSubItems?: () => CommandAction[];
  action: () => void | Promise<void>;
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .split(/[\s\-_:./]+/)
    .filter(Boolean);
}

/**
 * Character subsequence match: all query chars must appear in order in text.
 * Returns a quality score 0–1 (0 = no match). Higher = more contiguous/boundary hits.
 */
function subseqScore(text: string, query: string): number {
  let qi = 0;
  let consecutive = 0;
  let maxConsec = 0;
  let boundaryHits = 0;

  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      qi++;
      consecutive++;
      maxConsec = Math.max(maxConsec, consecutive);
      if (ti === 0 || text[ti - 1] === " " || text[ti - 1] === "-") boundaryHits++;
    } else {
      consecutive = 0;
    }
  }
  if (qi < query.length) return 0; // not all chars matched

  const consecBonus = maxConsec / query.length;
  const boundaryBonus = boundaryHits / query.length;
  return 0.4 + consecBonus * 0.4 + boundaryBonus * 0.2;
}

/**
 * Score how well `query` matches `action`. Returns 0 if no match,
 * higher numbers for better matches. Supports fuzzy / unordered tokens.
 *
 * Tiers (descending):
 *  100 — exact label prefix
 *   90 — label contains query as substring
 *   80 — any keyword/group term starts with query
 *   70 — any keyword/group term contains query
 *   65 — all query tokens match word-starts in label+keywords (unordered)
 *   55 — all query tokens found as substrings across label+keywords (unordered)
 *  20–39 — character subsequence match on label
 *  10–19 — character subsequence match on any keyword
 */
function score(action: CommandAction, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1; // no query → everything matches

  const labelLower = action.label.toLowerCase();

  // Build a flat corpus of individual word-tokens from label + keywords + group
  const labelTokens = tokenize(action.label);
  const keywordTokens = (action.keywords ?? []).flatMap((k) => tokenize(k));
  const groupTokens = tokenize(action.group);
  const allTokens = [...labelTokens, ...keywordTokens, ...groupTokens];

  // Also keep the raw keyword strings for substring matching
  const allStrings = [
    labelLower,
    ...(action.keywords ?? []).map((k) => k.toLowerCase()),
    action.group.toLowerCase(),
  ];

  // Tier 1: exact label prefix
  if (labelLower.startsWith(q)) return 100;
  // Tier 2: label contains query (ordered substring)
  if (labelLower.includes(q)) return 90;
  // Tier 3: any keyword/group string starts with query
  if (allStrings.slice(1).some((s) => s.startsWith(q))) return 80;
  // Tier 4: any keyword/group string contains query
  if (allStrings.slice(1).some((s) => s.includes(q))) return 70;

  // Tier 5–6: unordered multi-token matching
  const qTokens = tokenize(q);
  if (qTokens.length > 1 || q !== qTokens[0]) {
    // Every query token must match a word-start in the combined token pool
    if (qTokens.every((qt) => allTokens.some((t) => t.startsWith(qt)))) return 65;
    // Every query token must appear as a substring somewhere
    if (qTokens.every((qt) => allTokens.some((t) => t.includes(qt)))) return 55;
  }

  // Tier 7: fuzzy character subsequence on label
  const ls = subseqScore(labelLower, q);
  if (ls > 0) return Math.round(20 + ls * 19); // 20–39

  // Tier 8: fuzzy character subsequence on any keyword
  for (const s of allStrings.slice(1)) {
    const ks = subseqScore(s, q);
    if (ks > 0) return Math.round(10 + ks * 9); // 10–19
  }

  return 0;
}

const RECENT_KEY = "ls_cmd_recent";
const RECENT_MAX = 5;

class CommandRegistry {
  private actions = new Map<string, CommandAction>();
  private listeners = new Set<() => void>();

  getRecentIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    } catch {
      return [];
    }
  }

  recordUsed(id: string) {
    const prev = this.getRecentIds().filter((r) => r !== id);
    const next = [id, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  getRecent(): CommandAction[] {
    return this.getRecentIds()
      .map((id) => this.actions.get(id))
      .filter((a): a is CommandAction => !!a && (!a.when || a.when()));
  }

  getLastRun(): CommandAction | null {
    return this.getRecent()[0] ?? null;
  }

  register(action: CommandAction) {
    this.actions.set(action.id, action);
    this.notify();
  }

  unregister(id: string) {
    this.actions.delete(id);
    this.notify();
  }

  /** Re-register to update dynamic fields (e.g. when/getSubItems) */
  update(action: CommandAction) {
    this.actions.set(action.id, action);
    // No notify — callers refresh on every render anyway
  }

  getAll(): CommandAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Return actions matching the query, sorted by score descending.
   * Actions with when()===false are omitted. Enabled() is left to the caller.
   */
  search(query: string): CommandAction[] {
    const results: Array<{ action: CommandAction; score: number }> = [];
    for (const action of this.actions.values()) {
      if (action.when && !action.when()) continue;
      const s = score(action, query);
      if (s > 0) results.push({ action, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.map((r) => r.action);
  }

  /** Group all matching actions for display */
  grouped(query: string): Record<string, CommandAction[]> {
    const matched = this.search(query);
    const groups: Record<string, CommandAction[]> = {};
    for (const action of matched) {
      if (!groups[action.group]) groups[action.group] = [];
      groups[action.group].push(action);
    }
    return groups;
  }

  /** Subscribe to changes (register/unregister) */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

export const commandRegistry = new CommandRegistry();
