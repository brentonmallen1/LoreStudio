import {
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  Clock,
  Eye,
  Fingerprint,
  GitBranch,
  HeartPulse,
  Landmark,
  History,
  Home,
  Images,
  MapIcon,
  MapPin,
  MessageSquareMore,
  NotebookText,
  Network,
  PenLine,
  Send,
  Shuffle,
  Telescope,
  Undo2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { UIMode } from "./mode";

/** The five information domains from CLAUDE.md, plus Home and System. */
export type Domain = "home" | "manuscript" | "lorebook" | "compendium" | "codex" | "chronicle" | "system";

/**
 * A section of a grouped page (doc 12 P1): Lorebook › Characters, Chronicle › Versions.
 * Each is a deep link, a row under its page in the More menu and a palette command, so
 * grouping pages never hides where something lives.
 */
export interface RouteSection {
  id: string;
  /** Relative to the page's path ("" is the page's own path, its first section). */
  path: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Narrower than the page's modes (Twists is Studio only inside a both-modes Lorebook). */
  modes?: UIMode[];
  ai?: boolean;
  /** The URL parameter of an entry under the section (`/lorebook/characters/:entryId`). */
  detailParam?: string;
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
}

const BOTH: UIMode[] = ["writer", "studio"];
const STUDIO: UIMode[] = ["studio"];

/**
 * One list feeds the sidebar, the palette's navigation commands and the palette coverage test
 * (refactor doc 04 §2, decision D11). Add a page here first; the test fails until it has a command.
 */
export const STORY_ROUTES: StoryRoute[] = [
  {
    id: "overview",
    path: "",
    label: "Overview",
    icon: Home,
    domain: "home",
    modes: BOTH,
    keywords: ["home", "dashboard", "summary"],
  },
  {
    id: "write",
    path: "/write",
    label: "Write",
    icon: PenLine,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["editor", "scene", "manuscript", "prose"],
  },
  {
    id: "plan",
    path: "/plan",
    label: "Plan",
    icon: MapIcon,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["outline", "beats", "snowflake", "synopsis", "logline", "method", "scene list", "beat board"],
  },
  {
    id: "lorebook",
    path: "/lorebook",
    label: "Lorebook",
    icon: BookOpen,
    domain: "lorebook",
    modes: BOTH,
    keywords: ["canon", "lore", "world", "bible", "story bible"],
    sections: [
      {
        id: "identity",
        path: "",
        label: "Story Identity",
        icon: Fingerprint,
        keywords: ["logline", "premise", "goals", "themes", "identity", "intent"],
      },
      {
        id: "characters",
        path: "/characters",
        label: "Characters",
        icon: Users,
        keywords: ["cast", "people", "personae", "persona", "relationships", "who"],
        detailParam: "entryId",
      },
      {
        id: "places",
        path: "/places",
        label: "Places",
        icon: MapPin,
        keywords: ["locations", "settings", "setting", "world building", "worldbuilding", "where"],
        detailParam: "entryId",
      },
      {
        id: "threads",
        path: "/threads",
        label: "Plot Threads",
        icon: GitBranch,
        detailParam: "entryId",
        keywords: ["mice", "arcs", "plot", "subplot", "threads"],
      },
      {
        id: "twists",
        path: "/twists",
        label: "Twists",
        icon: Eye,
        detailParam: "entryId",
        modes: STUDIO,
        keywords: ["reveal", "clues", "reader knowledge", "surprise", "dramatic irony"],
      },
      {
        id: "systems",
        path: "/systems",
        label: "Systems",
        icon: Zap,
        detailParam: "entryId",
        keywords: ["magic", "technology", "rules", "world building", "worldbuilding"],
      },
      {
        id: "cultures",
        path: "/cultures",
        label: "Cultures",
        icon: Landmark,
        detailParam: "entryId",
        keywords: ["peoples", "customs", "religion", "world building", "worldbuilding"],
      },
      {
        id: "history",
        path: "/history",
        label: "History",
        icon: Clock,
        detailParam: "entryId",
        keywords: ["timeline", "eras", "events", "world building", "worldbuilding"],
      },
      {
        id: "calendars",
        path: "/calendars",
        label: "Calendars",
        icon: CalendarDays,
        detailParam: "entryId",
        keywords: ["dates", "months", "seasons", "world building", "worldbuilding"],
      },
      {
        id: "travel",
        path: "/travel",
        label: "Travel",
        icon: ArrowLeftRight,
        detailParam: "entryId",
        keywords: ["distances", "routes", "journeys", "world building", "worldbuilding"],
      },
    ],
  },
  {
    id: "compendium",
    path: "/compendium",
    label: "Compendium",
    icon: NotebookText,
    domain: "compendium",
    modes: BOTH,
    keywords: ["research", "references", "notes"],
    sections: [
      {
        id: "research",
        path: "",
        label: "Research",
        icon: NotebookText,
        keywords: ["notes", "links", "documents", "references", "sources"],
      },
      {
        id: "images",
        path: "/images",
        label: "Images",
        icon: Images,
        keywords: ["media", "pictures", "assets", "attachments", "portraits"],
      },
      {
        id: "diagrams",
        path: "/diagrams",
        label: "Diagrams",
        icon: Network,
        keywords: ["media", "mindmap", "flowchart", "charts"],
      },
    ],
  },
  {
    id: "whatif",
    path: "/whatif",
    label: "What If?",
    icon: Shuffle,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["alternate", "explore", "what-if", "simulate"],
  },
  {
    id: "panels",
    path: "/panels",
    label: "Group Interviews",
    icon: MessageSquareMore,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["panel", "interview", "group"],
  },
  {
    id: "codex",
    path: "/codex",
    label: "Codex Review",
    icon: Network,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["suggestions", "knowledge graph", "who is here", "confirm", "review queue"],
  },
  {
    id: "discoveries",
    path: "/discoveries",
    label: "Discoveries",
    icon: Telescope,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["extracted", "suggestions", "nlp", "entities"],
  },
  {
    id: "health",
    path: "/health",
    label: "Story Health",
    icon: HeartPulse,
    domain: "system",
    modes: BOTH,
    keywords: ["report", "analysis", "checks", "check"],
  },
  {
    id: "chronicle",
    path: "/chronicle",
    label: "Chronicle",
    icon: Clock,
    domain: "chronicle",
    modes: BOTH,
    keywords: ["history", "log", "ai log"],
    sections: [
      {
        id: "activity",
        path: "",
        label: "Activity",
        icon: Clock,
        keywords: ["jobs", "calls", "analyses", "runs", "what happened"],
      },
      {
        id: "conversations",
        path: "/conversations",
        label: "Conversations",
        icon: MessageSquareMore,
        ai: true,
        keywords: ["chats", "sessions", "interviews", "transcripts"],
      },
      {
        id: "changes",
        path: "/changes",
        label: "Changes",
        icon: Undo2,
        keywords: ["edits", "undo", "change log"],
      },
      {
        id: "versions",
        path: "/versions",
        label: "Versions",
        icon: History,
        keywords: ["snapshots", "backups", "restore", "backup", "version history"],
      },
    ],
  },
  {
    id: "publish",
    path: "/publish",
    label: "Publish",
    icon: Send,
    domain: "system",
    modes: STUDIO,
    keywords: ["export", "query letter", "synopsis", "share"],
  },
];

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

/**
 * Old paths that now live inside a grouped page (doc 12 P1). Relative to `/stories/:storyId`;
 * `:params` carry over, and so do the query string and navigation state. Every page that was
 * merged keeps its address working, so bookmarks and links from older notes still land.
 */
export const STORY_REDIRECTS: { from: string; to: string }[] = [
  { from: "/characters", to: "/lorebook/characters" },
  { from: "/characters/:entryId", to: "/lorebook/characters/:entryId" },
  { from: "/locations/:entryId", to: "/lorebook/places/:entryId" },
  { from: "/worldbuilding", to: "/lorebook/places" },
  { from: "/threads", to: "/lorebook/threads" },
  { from: "/twists", to: "/lorebook/twists" },
  { from: "/media", to: "/compendium/images" },
  { from: "/versions", to: "/chronicle/versions" },
];

/** Fill `:name` segments of a redirect target from the matched params. */
export function fillParams(pattern: string, params: Record<string, string | undefined>): string {
  return pattern.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
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

/** Pages and their sections in one list, for the palette, the More menu and the tests. */
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
