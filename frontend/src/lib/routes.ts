import {
  ArrowLeftRight,
  BarChart3,
  Book,
  BookOpen,
  CalendarDays,
  Clock,
  Eye,
  Fingerprint,
  GitBranch,
  ScanEye,
  Landmark,
  Library,
  History,
  Images,
  MapIcon,
  MapPin,
  MessageSquareMore,
  NotebookPen,
  NotebookText,
  Network,
  PenLine,
  Send,
  StickyNote,
  Inbox,
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
  /** Narrower than the page's modes (a Studio-only section inside a both-modes page). */
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
    icon: Book,
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
    // Loose writing, a heading for each day; words made into notes and characters (doc 15 N3).
    id: "freewrite",
    path: "/freewrite",
    label: "Freewrite",
    icon: NotebookPen,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["ideas", "brain dump", "stream of consciousness", "journal", "loose", "capture"],
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
      {
        // The Codex graph (doc 12 P5): what the story's things are to each other. Building it
        // uses no AI, so both modes have it (doc 13 D2).
        id: "connections",
        path: "/connections",
        label: "Connections",
        icon: Network,
        keywords: ["codex", "knowledge graph", "graph", "network", "relationships map"],
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
        // Everything in the Compendium in one list (doc 13 P5).
        id: "everything",
        path: "",
        label: "Everything",
        icon: Library,
        keywords: ["index", "all", "search compendium"],
      },
      {
        id: "research",
        path: "/research",
        label: "Research",
        icon: NotebookText,
        detailParam: "entryId",
        keywords: ["notes", "links", "documents", "references", "sources"],
      },
      {
        // Notes, questions, to-dos and ideas, wherever they are tied (doc 15 N2).
        id: "notes",
        path: "/notes",
        label: "Notes",
        icon: StickyNote,
        keywords: ["to-do", "todo", "questions", "open questions", "ideas", "margin notes", "comments"],
      },
      {
        id: "images",
        path: "/images",
        label: "Images",
        icon: Images,
        detailParam: "entryId",
        keywords: ["media", "pictures", "assets", "attachments", "portraits"],
      },
      {
        id: "diagrams",
        path: "/diagrams",
        label: "Diagrams",
        icon: Network,
        detailParam: "entryId",
        keywords: ["media", "mindmap", "flowchart", "charts"],
      },
    ],
  },
  {
    // Doc 12 P5: what the app noticed and the author has not decided, in one inbox.
    id: "proposals",
    path: "/proposals",
    label: "Proposals",
    icon: Inbox,
    domain: "lorebook",
    modes: BOTH,
    keywords: [
      "discoveries",
      "nlp discoveries",
      "codex review",
      "review queue",
      "suggestions",
      "new names",
      "stubs",
      "found in your prose",
      "unattributed dialogue",
    ],
  },
  {
    id: "findings",
    path: "/findings",
    label: "Findings",
    icon: ScanEye,
    domain: "system",
    modes: BOTH,
    // Story Health was this page's name until doc 12 P4; people will still look for it.
    keywords: ["story health", "what needs my eye", "issues", "problems", "report", "analysis", "checks"],
  },
  {
    // What Story Health measured, back on a page of its own (doc 13 P3, D5).
    id: "numbers",
    path: "/numbers",
    label: "Numbers",
    icon: BarChart3,
    domain: "system",
    modes: BOTH,
    keywords: [
      "stats",
      "statistics",
      "metrics",
      "pacing",
      "screen time",
      "dialogue",
      "word count",
      "progress",
    ],
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
