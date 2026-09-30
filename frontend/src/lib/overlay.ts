import { STORY_ROUTES } from "./routes";

/**
 * Settings and Guides open over the page you were on, not instead of it.
 *
 * They used to be ordinary pages: opening one unmounted the scene editor, and the only way
 * back was the browser's Back button or the dashboard. Now the page underneath stays
 * mounted (editor, scroll position, open panels) and closing returns to it exactly.
 *
 * Nothing that opens them needs to know. App watches the location: when it moves onto an
 * overlay path, the last ordinary page stays rendered behind it. The URL still changes,
 * so deep links, the palette and a reload all keep working.
 */

/** Paths that open as an overlay, with everything under them. */
export const OVERLAY_PATHS = ["/settings", "/guides"];

export function isOverlayPath(pathname: string): boolean {
  return OVERLAY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Where the overlay was opened from: enough to render that page and to return to it. */
export interface OverlayOrigin {
  pathname: string;
  search: string;
  hash: string;
  /** React Router's history index for that entry, so closing can step back to it. */
  idx: number | null;
}

/** React Router keeps its entry index in `history.state.idx`. */
export function historyIndex(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

export function originPath(origin: OverlayOrigin): string {
  return `${origin.pathname}${origin.search}${origin.hash}`;
}

/**
 * How far back to step to close the overlay, or null to navigate to the origin instead.
 *
 * Stepping back (rather than pushing the origin again) leaves history as it was before the
 * overlay opened, so Back afterwards does not reopen Settings. It only works when the
 * origin's entry is behind the current one; otherwise, navigate.
 */
export function closeDelta(origin: OverlayOrigin | null, current: number | null): number | null {
  if (!origin || origin.idx === null || current === null || current <= origin.idx) return null;
  return origin.idx - current;
}

/** "Write", "Characters", "Dashboard": the name of the page (or section) the overlay covers. */
export function originLabel(pathname: string): string {
  const match = pathname.match(/^\/stories\/[^/]+(\/[^/]+)?(\/[^/]+)?/);
  if (!match) return "Dashboard";
  const route = STORY_ROUTES.find((r) => r.path === (match[1] ?? ""));
  if (!route) return "story";
  const section = match[2] ? route.sections?.find((s) => s.path === match[2]) : undefined;
  return section?.label ?? route.label;
}

// ── Surviving a reload ─────────────────────────────────────────────────
// A reload inside Settings would otherwise forget what was underneath. sessionStorage is
// per tab, which is the right scope: another tab has its own history.

const STORAGE_KEY = "ls_overlay_origin";

export function saveOrigin(origin: OverlayOrigin | null): void {
  try {
    if (origin) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origin));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows can refuse storage; the overlay still works, just not across reloads.
  }
}

export function loadOrigin(): OverlayOrigin | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OverlayOrigin;
    return typeof parsed?.pathname === "string" && !isOverlayPath(parsed.pathname) ? parsed : null;
  } catch {
    return null;
  }
}
