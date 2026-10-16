import type { LucideIcon } from "lucide-react";
import type { UIMode } from "./mode";
import { WRITE_ROUTES } from "./routeTable/manuscript";
import { CANON_ROUTES } from "./routeTable/canon";
import { REVIEW_ROUTES } from "./routeTable/review";

/** The five information domains from CLAUDE.md, plus Home and System. */
export type Domain = "home" | "manuscript" | "lorebook" | "compendium" | "codex" | "chronicle" | "system";

/**
 * A section of a grouped page (doc 12 P1): Lorebook › Characters, Chronicle › Versions.
 * Each is a deep link, a word under its page in the logo menu and a palette command, so
 * grouping pages never hides where something lives.
 */
export interface RouteSection {
  id: string;
  /** Relative to the page's path ("" is the page's own path, its first section). */
  path: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Narrower than the page's modes (a Studio-only section inside a both-modes page). */
  modes?: UIMode[];
  ai?: boolean;
  /** The URL parameter of an entry under the section (`/lorebook/characters/:entryId`). */
  detailParam?: string;
  /** What the section is for, in a line (doc 30 D2): under its title, and its logo-menu tooltip. */
  purpose?: string;
  /** The guide its header's "How this page works" opens (an id in `guides/index.ts`). */
  guide?: string;
}

export interface StoryRoute {
  id: string;
  /** Path relative to `/stories/:storyId` ("" is the overview). */
  path: string;
  label: string;
  icon: LucideIcon;
  domain: Domain;
  modes: UIMode[];
  keywords?: string[];
  /** Set when the page is entirely an AI feature (never shown in Writer mode). */
  ai?: boolean;
  sections?: RouteSection[];
  /** What the page is for, in a line (A2, doc 30 D2): under its title, and its logo-menu
   *  tooltip. `lib/pageAbout.test.ts` fails on a page or section without one. */
  purpose?: string;
  /** The guide its header's "How this page works" opens (an id in `guides/index.ts`). */
  guide?: string;
}

/**
 * One list feeds the sidebar, the palette's navigation commands and the palette coverage test
 * (refactor doc 04 §2, decision D11). Add a page here first; the test fails until it has a command.
 */
export const STORY_ROUTES: StoryRoute[] = [...WRITE_ROUTES, ...CANON_ROUTES, ...REVIEW_ROUTES];

/**
 * Addresses that moved, old prefix to new, under `/stories/:storyId`. The rest of the address
 * (an entry id) carries over, so old links and bookmarks still land.
 */
export const STORY_REDIRECTS: Record<string, string> = {
  "/lorebook/threads": "/promises/threads",
  "/proposals": "/discoveries",
  "/lorebook/twists": "/promises/twists",
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  home: "",
  manuscript: "Manuscript",
  lorebook: "Lorebook",
  compendium: "Compendium",
  codex: "Codex",
  chronicle: "Chronicle",
  system: "Story",
};

export function storyPath(storyId: string, route: StoryRoute): string {
  return `/stories/${storyId}${route.path}`;
}

export function routesFor(mode: UIMode): StoryRoute[] {
  return STORY_ROUTES.filter((r) => r.modes.includes(mode));
}

export function findRoute(id: string): StoryRoute | undefined {
  return STORY_ROUTES.find((r) => r.id === id);
}

/**
 * The address of a section, or of an entry under it: `sectionPath(id, "lorebook",
 * "characters", characterId)`. Links go through this so no caller spells a merged path.
 */
export function sectionPath(storyId: string, routeId: string, sectionId: string, entryId?: string): string {
  const route = findRoute(routeId);
  const section = route?.sections?.find((s) => s.id === sectionId);
  if (!route || !section) throw new Error(`Unknown section ${routeId}.${sectionId}`);
  const base = `/stories/${storyId}${route.path}${section.path}`;
  return entryId ? `${base}/${entryId}` : base;
}

/** A section's own modes and AI flag, falling back to its page's. */
export function sectionModes(route: StoryRoute, section: RouteSection): { modes: UIMode[]; ai: boolean } {
  return { modes: section.modes ?? route.modes, ai: Boolean(section.ai ?? route.ai) };
}

/** What a page or section is for, and its guide: the section's own, else its page's. */
export function pageAbout(route: StoryRoute, section?: RouteSection): { purpose?: string; guide?: string } {
  return { purpose: section?.purpose ?? route.purpose, guide: section?.guide ?? route.guide };
}

/** Pages and their sections in one list, for the palette, the logo menu and the tests. */
export interface NavEntry {
  route: StoryRoute;
  section?: RouteSection;
  /** `lorebook` or `lorebook.characters`. */
  key: string;
  label: string;
  path: string;
  modes: UIMode[];
  ai: boolean;
}

export function flatRoutes(mode?: UIMode): NavEntry[] {
  const out: NavEntry[] = [];
  for (const route of STORY_ROUTES) {
    out.push({
      route,
      key: route.id,
      label: route.label,
      path: route.path,
      modes: route.modes,
      ai: Boolean(route.ai),
    });
    for (const section of route.sections ?? []) {
      const { modes, ai } = sectionModes(route, section);
      out.push({
        route,
        section,
        key: `${route.id}.${section.id}`,
        label: section.label,
        path: route.path + section.path,
        modes,
        ai,
      });
    }
  }
  return mode ? out.filter((e) => e.modes.includes(mode)) : out;
}
