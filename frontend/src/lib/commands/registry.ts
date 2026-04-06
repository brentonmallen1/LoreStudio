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
  return str.toLowerCase().split(/[\s\-_:./]+/).filter(Boolean);
}

/**
 * Score how well `query` matches `action`. Returns 0 if no match,
 * higher numbers for better matches.
 */
function score(action: CommandAction, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1; // no query → everything matches

  const labelLower = action.label.toLowerCase();
  const allTerms = [
    ...tokenize(action.label),
    ...(action.keywords ?? []).map((k) => k.toLowerCase()),
    action.group.toLowerCase(),
  ];

  // Exact label prefix
  if (labelLower.startsWith(q)) return 100;
  // Exact label contains
  if (labelLower.includes(q)) return 80;
  // Any single keyword starts with query
  for (const term of allTerms) {
    if (term.startsWith(q)) return 70;
  }
  // Any keyword contains query
  for (const term of allTerms) {
    if (term.includes(q)) return 50;
  }
  // All query tokens appear somewhere
  const qTokens = tokenize(q);
  if (qTokens.every((t) => allTerms.some((term) => term.includes(t)))) return 30;
  return 0;
}

class CommandRegistry {
  private actions = new Map<string, CommandAction>();
  private listeners = new Set<() => void>();

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
