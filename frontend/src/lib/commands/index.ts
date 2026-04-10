/**
 * Command registry initialization.
 * Import this once at app startup to register all static commands.
 * Dynamic commands (story/character-specific) are registered reactively in CommandPalette.
 */
import {
  Settings,
  Sun,
  Moon,
  Maximize2,
  LogOut,
  Palette,
  MessageSquare,
  Feather,
  BookOpen,
  Users,
} from "lucide-react";
import { commandRegistry } from "./registry";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";

// ── Navigation ────────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "nav-settings",
  label: "Settings",
  keywords: ["settings", "preferences", "config"],
  icon: Settings,
  group: "Navigation",
  action: () => { window.location.href = "/settings"; },
});

// ── AI sessions ───────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "open-assistant",
  label: "Open Assistant",
  keywords: ["assistant", "ai", "chat", "help", "feather"],
  icon: Feather,
  group: "AI",
  shortcut: "⌘/",
  action: async () => {
    const { sessions, createSession, setActiveSession, openPanel } = useAIStore.getState();
    const { activeStory, activeNode } = useStoryStore.getState();
    const existing = sessions.find((s) => s.type === "assistant");
    if (existing) {
      setActiveSession(existing.id);
      openPanel();
    } else {
      await createSession("assistant", {
        storyId: activeStory?.id,
        nodeId: activeNode?.id,
      });
    }
  },
});

commandRegistry.register({
  id: "ai-interview",
  label: "Interview character…",
  keywords: ["interview", "int", "talk", "chat", "character", "persona"],
  icon: MessageSquare,
  group: "AI",
  shortcut: "⌘⇧I",
  when: () => useStoryStore.getState().characters.length > 0,
  getSubItems: () => {
    const { characters } = useStoryStore.getState();
    return characters.map((c) => ({
      id: `ai-interview-${c.id}`,
      label: c.name,
      description: c.role ?? undefined,
      keywords: [c.name.toLowerCase(), "interview"],
      icon: Users,
      group: "Characters",
      action: async () => {
        const { createSession } = useAIStore.getState();
        await createSession("interview", {
          characterId: c.id,
          storyId: c.story_id,
        });
      },
    }));
  },
  action: () => {}, // Opens sub-menu via getSubItems
});

commandRegistry.register({
  id: "ai-scene-assistant",
  label: "Scene assistant",
  keywords: ["scene", "assistant", "help", "chat", "write", "narrate"],
  icon: Feather,
  group: "AI",
  when: () => !!useStoryStore.getState().activeStory,
  action: async () => {
    const { activeStory, activeNode } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    await createSession("scene-assistant", {
      storyId: activeStory?.id,
      nodeId: activeNode?.id,
    });
  },
});

commandRegistry.register({
  id: "ai-story-assistant",
  label: "Story assistant",
  keywords: ["story", "assistant", "arc", "theme", "plot", "help", "overview"],
  icon: BookOpen,
  group: "AI",
  when: () => !!useStoryStore.getState().activeStory,
  action: async () => {
    const { activeStory } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    await createSession("story-assistant", {
      storyId: activeStory?.id,
    });
  },
});

// ── Appearance ────────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "appearance-light",
  label: "Color mode: Light",
  keywords: ["light", "mode", "theme", "color", "appearance"],
  icon: Sun,
  group: "Appearance",
  action: () => useUIStore.getState().setColorMode("light"),
});

commandRegistry.register({
  id: "appearance-dark",
  label: "Color mode: Dark",
  keywords: ["dark", "mode", "theme", "color", "appearance"],
  icon: Moon,
  group: "Appearance",
  action: () => useUIStore.getState().setColorMode("dark"),
});

const THEMES = ["zen", "e-ink", "nord", "solarized", "dracula", "gruvbox", "catppuccin"] as const;
THEMES.forEach((name) => {
  commandRegistry.register({
    id: `theme-${name}`,
    label: `Theme: ${name.charAt(0).toUpperCase() + name.slice(1)}`,
    keywords: ["theme", name, "appearance"],
    icon: Palette,
    group: "Appearance",
    action: () => useUIStore.getState().setThemeName(name),
  });
});

// ── View ──────────────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "view-focus",
  label: "Toggle focus mode",
  keywords: ["focus", "fullscreen", "distraction", "zen"],
  icon: Maximize2,
  group: "View",
  action: () => {
    const { viewState, setViewState } = useUIStore.getState();
    setViewState(viewState === "focus" ? "normal" : "focus");
  },
});

// ── Account ───────────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "account-logout",
  label: "Sign out",
  keywords: ["logout", "sign out", "exit"],
  icon: LogOut,
  group: "Account",
  action: () => useAuthStore.getState().logout(),
});
