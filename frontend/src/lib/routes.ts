import {
  BookOpen,
  Clock,
  Eye,
  Fingerprint,
  GitBranch,
  Globe,
  HeartPulse,
  History,
  Home,
  Images,
  ListTree,
  MessageSquareMore,
  PenLine,
  Send,
  Shuffle,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UIMode } from "./mode";

/** The five information domains from CLAUDE.md, plus Home and System. */
export type Domain = "home" | "manuscript" | "lorebook" | "compendium" | "codex" | "chronicle" | "system";

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
    keywords: ["home", "dashboard"],
  },
  {
    id: "write",
    path: "/write",
    label: "Write",
    icon: PenLine,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["editor", "scene", "manuscript"],
  },
  {
    id: "outline",
    path: "/outline",
    label: "Outline",
    icon: ListTree,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["beats", "plan"],
  },
  {
    id: "threads",
    path: "/threads",
    label: "Plot Threads",
    icon: GitBranch,
    domain: "manuscript",
    modes: BOTH,
    keywords: ["mice", "arcs"],
  },
  {
    id: "lorebook",
    path: "/lorebook",
    label: "Story Identity",
    icon: Fingerprint,
    domain: "lorebook",
    modes: BOTH,
    keywords: ["logline", "premise", "goals", "themes"],
  },
  {
    id: "characters",
    path: "/characters",
    label: "Characters",
    icon: Users,
    domain: "lorebook",
    modes: BOTH,
    keywords: ["cast", "relationships"],
  },
  {
    id: "worldbuilding",
    path: "/worldbuilding",
    label: "World Building",
    icon: Globe,
    domain: "lorebook",
    modes: BOTH,
    keywords: ["locations", "settings", "cultures", "calendars"],
  },
  {
    id: "twists",
    path: "/twists",
    label: "Twists",
    icon: Eye,
    domain: "lorebook",
    modes: STUDIO,
    keywords: ["reveal", "clues", "reader knowledge"],
  },
  {
    id: "compendium",
    path: "/compendium",
    label: "Compendium",
    icon: BookOpen,
    domain: "compendium",
    modes: BOTH,
    keywords: ["research", "references", "notes"],
  },
  {
    id: "media",
    path: "/media",
    label: "Media & Diagrams",
    icon: Images,
    domain: "compendium",
    modes: BOTH,
    keywords: ["images", "diagrams", "assets"],
  },
  {
    id: "whatif",
    path: "/whatif",
    label: "What If?",
    icon: Shuffle,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["alternate", "explore"],
  },
  {
    id: "panels",
    path: "/panels",
    label: "Group Interviews",
    icon: MessageSquareMore,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["panel", "interview"],
  },
  {
    id: "discoveries",
    path: "/discoveries",
    label: "Discoveries",
    icon: Telescope,
    domain: "codex",
    modes: STUDIO,
    ai: true,
    keywords: ["extracted", "suggestions"],
  },
  {
    id: "health",
    path: "/health",
    label: "Story Health",
    icon: HeartPulse,
    domain: "system",
    modes: BOTH,
    keywords: ["report", "analysis", "checks"],
  },
  {
    id: "chronicle",
    path: "/chronicle",
    label: "Chronicle",
    icon: Clock,
    domain: "chronicle",
    modes: BOTH,
    keywords: ["history", "activity", "changes", "sessions"],
  },
  {
    id: "versions",
    path: "/versions",
    label: "Versions",
    icon: History,
    domain: "chronicle",
    modes: BOTH,
    keywords: ["snapshots", "backups", "restore"],
  },
  {
    id: "publish",
    path: "/publish",
    label: "Publish",
    icon: Send,
    domain: "system",
    modes: STUDIO,
    keywords: ["export", "query letter", "synopsis"],
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
