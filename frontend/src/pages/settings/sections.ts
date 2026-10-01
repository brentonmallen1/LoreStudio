import {
  Archive,
  Cpu,
  Keyboard,
  Network,
  Palette,
  ShieldCheck,
  Sliders,
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
 * (`/settings#appearance`). Sections render in this order (refactor doc 04 §4).
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    modes: BOTH,
    keywords: ["theme", "mode", "dark", "writer", "studio"],
  },
  { id: "typography", label: "Typography", icon: Type, modes: BOTH, keywords: ["font", "editor width"] },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, modes: BOTH, keywords: ["keyboard", "keys"] },
  { id: "ai", label: "AI / LLM", icon: Cpu, modes: ["studio"], keywords: ["ollama", "model", "assistant"] },
  {
    id: "model-parameters",
    label: "Model parameters",
    icon: Sliders,
    modes: ["studio"],
    keywords: ["temperature", "thinking", "top_p"],
  },
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
    id: "backups",
    label: "Backups",
    icon: Archive,
    modes: BOTH,
    keywords: ["snapshots", "database", "restore"],
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: ShieldCheck,
    modes: BOTH,
    keywords: ["what leaves this machine", "telemetry", "hosts"],
  },
  { id: "account", label: "Account", icon: User, modes: BOTH, keywords: ["user", "logout", "password"] },
];

export function settingsPath(section: SettingsSection): string {
  return section.path ?? `/settings#${section.id}`;
}
