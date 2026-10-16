import {
  Archive,
  CalendarClock,
  Cpu,
  Info,
  Keyboard,
  Network,
  PenLine,
  Palette,
  ShieldCheck,
  Sliders,
  ToggleRight,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";
import type { UIMode } from "../../lib/mode";

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  modes: UIMode[];
  /** Separate page instead of an anchor on /settings. */
  path?: string;
  keywords?: string[];
}

const BOTH: UIMode[] = ["writer", "studio"];

/**
 * One list feeds the Settings side nav, the palette ("Settings › …") and deep links
 * (`/settings#mode`). Sections render in this order (refactor doc 04 §4).
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "mode",
    label: "Mode",
    icon: ToggleRight,
    modes: BOTH,
    keywords: ["writer", "studio", "assistant", "ai", "just me", "welcome"],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    modes: BOTH,
    keywords: ["theme", "dark", "light", "color mode", "palette"],
  },
  {
    id: "typography",
    label: "Typography",
    icon: Type,
    modes: BOTH,
    keywords: ["font", "editor width", "interface size", "ui size", "text size", "bigger", "zoom"],
  },
  {
    id: "writing",
    label: "Writing",
    icon: PenLine,
    modes: BOTH,
    keywords: ["tips", "hints", "typing help", "what you can type"],
  },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, modes: BOTH, keywords: ["keyboard", "keys"] },
  { id: "ai", label: "AI / LLM", icon: Cpu, modes: ["studio"], keywords: ["ollama", "model", "assistant"] },
  {
    id: "ai-prompts",
    label: "AI prompts",
    icon: Cpu,
    modes: ["studio"],
    path: "/settings/ai-prompts",
    keywords: ["system prompt", "feature prompts"],
  },
  {
    id: "codex",
    label: "Codex",
    icon: Network,
    modes: ["studio"],
    keywords: ["embeddings", "index", "knowledge graph", "retrieval", "semantic"],
  },
  {
    id: "model-parameters",
    label: "Advanced",
    icon: Sliders,
    modes: ["studio"],
    keywords: [
      "model parameters",
      "temperature",
      "thinking",
      "top_p",
      "top-k",
      "image token budget",
      "context window",
      "jobs wait",
      "parallel",
    ],
  },
  {
    id: "backups",
    label: "Versions and backups",
    icon: Archive,
    modes: BOTH,
    keywords: ["backups", "versions", "snapshots", "auto backups", "database", "restore"],
  },
  {
    id: "automatic",
    label: "Automatic work",
    icon: CalendarClock,
    modes: BOTH,
    keywords: ["schedule", "background", "housekeeping", "prune", "retention", "tasks", "cadence"],
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: ShieldCheck,
    modes: BOTH,
    keywords: ["what leaves this machine", "telemetry", "hosts"],
  },
  {
    id: "about",
    label: "About and updates",
    icon: Info,
    modes: BOTH,
    keywords: ["version", "update", "upgrade", "release", "new version", "check for updates"],
  },
  {
    id: "account",
    label: "Account",
    icon: User,
    modes: BOTH,
    keywords: ["user", "logout", "password", "example stories", "demo", "sample"],
  },
];

export function settingsPath(section: SettingsSection): string {
  return section.path ?? `/settings#${section.id}`;
}
