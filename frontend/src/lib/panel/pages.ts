import { STORY_ROUTES, findRoute, type RouteSection, type StoryRoute } from "../routes";
import type { UIMode } from "../mode";

/**
 * Pages beside the prose (doc 24 D2): any page can open as a tab in the side panel, drawn in
 * the panel's narrow container, with "Full page ↗" to go to the real thing. These are not
 * offered, each for the reason given.
 */
export const NOT_BESIDE: Record<string, string> = {
  write: "it is the prose itself",
};

export function canOpenBeside(route: StoryRoute): boolean {
  return !(route.id in NOT_BESIDE);
}

/** The pages that can open beside the prose in this mode, in the table's order. */
export function besideRoutes(mode: UIMode, aiAvailable: boolean): StoryRoute[] {
  return STORY_ROUTES.filter((r) => canOpenBeside(r) && r.modes.includes(mode) && (!r.ai || aiAvailable));
}

/** Drop a trailing slash; the overview is "". */
const tidy = (path: string) => path.replace(/\/+$/, "");

/** The page a story-relative path is on (`/lorebook/places/abc` is the Lorebook). */
export function routeAt(path: string): StoryRoute | undefined {
  const clean = tidy(path);
  let best: StoryRoute | undefined;
  for (const r of STORY_ROUTES) {
    const hit = r.path === "" ? clean === "" : clean === r.path || clean.startsWith(`${r.path}/`);
    if (hit && (!best || r.path.length > best.path.length)) best = r;
  }
  return best;
}

/** The section of a grouped page a story-relative path is on, the page's first when none is named. */
export function sectionAt(route: StoryRoute, path: string): RouteSection | undefined {
  const clean = tidy(path);
  let best: RouteSection | undefined;
  for (const s of route.sections ?? []) {
    const full = route.path + s.path;
    const hit = s.path === "" ? true : clean === full || clean.startsWith(`${full}/`);
    if (hit && (!best || s.path.length > best.path.length)) best = s;
  }
  return best;
}

/** A path inside the app, relative to its story (`/storyboard`), or null when it is not in it. */
export function storyRelative(storyId: string, pathname: string): string | null {
  const base = `/stories/${storyId}`;
  if (pathname === base) return "";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null;
}

/**
 * Whether a move from inside a page tab stays in the tab (between the Lorebook's sections, or
 * to an entry) or belongs to the main window (a Storyboard card opening its scene).
 */
export function staysInPage(routeId: string, path: string): boolean {
  return routeAt(path)?.id === routeId;
}

/** A page tab's name, the page; and its tooltip, which adds the section it is on. */
export function pageTabLabel(routeId: string, path: string): { label: string; title: string } {
  const route = findRoute(routeId);
  if (!route) return { label: routeId, title: routeId };
  const section = sectionAt(route, path);
  const title = section && section.label !== route.label ? `${route.label} › ${section.label}` : route.label;
  return { label: route.label, title };
}

/** The path a page opens at: its own, or one of its sections'. */
export function besidePath(routeId: string, sectionId?: string): string | null {
  const route = findRoute(routeId);
  if (!route || !canOpenBeside(route)) return null;
  const section = sectionId ? route.sections?.find((s) => s.id === sectionId) : undefined;
  return route.path + (section?.path ?? "");
}
