/**
 * How the Outline is looked at (doc 29 D2): List or Cards, as the reader meets it or as it
 * happens. Window layout, so kept per device in localStorage (frontend CLAUDE.md), and it may
 * be blocked or empty: every read falls back to List, in reading order.
 */

export type OutlineView = "list" | "cards";
export type OutlineOrder = "reader" | "time";

export const OUTLINE_VIEWS: { id: OutlineView; label: string }[] = [
  { id: "list", label: "List" },
  { id: "cards", label: "Cards" },
];

export const OUTLINE_ORDERS: { id: OutlineOrder; label: string }[] = [
  { id: "reader", label: "As the reader meets it" },
  { id: "time", label: "As it happens" },
];

const VIEW_KEY = "ls_outline_view";
const ORDER_KEY = "ls_outline_order";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Site data blocked: the choice lasts until the page is left.
  }
}

export function asView(value: string | null | undefined): OutlineView | null {
  return value === "list" || value === "cards" ? value : null;
}

export function asOrder(value: string | null | undefined): OutlineOrder | null {
  return value === "reader" || value === "time" ? value : null;
}

export const loadView = (): OutlineView => asView(read(VIEW_KEY)) ?? "list";
export const loadOrder = (): OutlineOrder => asOrder(read(ORDER_KEY)) ?? "reader";
export const saveView = (view: OutlineView) => write(VIEW_KEY, view);
export const saveOrder = (order: OutlineOrder) => write(ORDER_KEY, order);

/** The parts folded in one story's Outline. */
export function loadFolded(storyId: string): Set<string> {
  try {
    const raw = JSON.parse(read(`ls_outline_folded_${storyId}`) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveFolded(storyId: string, ids: Set<string>): void {
  write(`ls_outline_folded_${storyId}`, JSON.stringify([...ids]));
}
