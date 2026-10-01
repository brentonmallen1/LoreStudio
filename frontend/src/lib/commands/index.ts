import { announceScenesRewritten } from "../sceneEvents";
/**
 * Command registry initialization.
 * Import this once at app startup to register all static commands.
 * Dynamic commands (story/character-specific) are registered reactively in CommandPalette.
 */
import {
  Sun,
  Moon,
  Maximize2,
  LogOut,
  Palette,
  MessageSquare,
  Feather,
  BookOpen,
  Users,
  Compass,
  Search,
  Quote,
  BookMarked,
  SquareLibrary,
  PenLine,
  Download,
  PanelRight,
} from "lucide-react";
import { commandRegistry } from "./registry";
import "./planning";
import "./panel";
import "./strip";
import "./findings";
import "./sessions";
import { SHORTCUTS, formatCombo } from "../keyboard/shortcuts";
import { toolsApi } from "../../api/tools";
import { STORY_ROUTES, sectionModes, sectionPath, storyPath } from "../routes";
import { SETTINGS_SECTIONS, settingsPath } from "../../pages/settings/sections";
import { navigateTo } from "../navigation";
import { getAIAvailable, getMode } from "../mode";
import { GUIDES } from "../../guides";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { useStoryStore } from "../../stores/storyStore";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";

// ── Manuscript tools (non-AI) ─────────────────────────────────────────────────

for (const style of ["curly", "straight"] as const) {
  commandRegistry.register({
    id: `quotes-normalize-${style}`,
    label:
      style === "curly" ? "Normalize quotes: make all curly “ ”" : 'Normalize quotes: make all straight " "',
    keywords: ["quotes", "quotation", "smart quotes", "typography", style],
    icon: Quote,
    group: "Manuscript",
    when: () => Boolean(useStoryStore.getState().activeStory),
    action: async () => {
      const story = useStoryStore.getState().activeStory;
      if (!story) return;
      const preview = await toolsApi.normalizeQuotes(story.id, { style, dry_run: true });
      if (preview.changed_chars === 0) return;
      if (
        !window.confirm(
          `Convert ${preview.changed_chars} quote characters in ${preview.scenes.length} scene(s) to ${style} quotes?`,
        )
      )
        return;
      const done = await toolsApi.normalizeQuotes(story.id, { style });
      announceScenesRewritten(done.scenes.map((scene) => scene.node_id));
    },
  });
}

commandRegistry.register({
  id: "scratch-pad",
  label: "Toggle scratch pad",
  keywords: ["scratch", "notes", "jot", "pad"],
  icon: PenLine,
  group: "Global",
  action: () => useUIStore.getState().toggleScratchPad(),
});

for (const guide of GUIDES) {
  commandRegistry.register({
    id: `guide-${guide.id}`,
    label: `Guide: ${guide.title}`,
    keywords: ["guide", "help", "how to", "?", ...guide.keywords],
    icon: BookOpen,
    group: "Guides",
    when: () => guide.modes.includes(getMode()),
    action: () => navigateTo(`/guides/${guide.id}`),
  });
}

// ── Navigation (generated from lib/routes.ts and settings/sections.ts) ─────────

for (const route of STORY_ROUTES) {
  commandRegistry.register({
    id: `nav-${route.id}`,
    label: route.id === "overview" ? "Story overview" : `Go to ${route.label}`,
    keywords: [
      "go to",
      "open",
      route.label.toLowerCase(),
      ...(route.keywords ?? []),
      ...(route.sections ?? []).map((s) => s.label.toLowerCase()),
    ],
    icon: route.icon,
    group: route.ai ? "AI" : "Navigation",
    when: () => {
      const story = useStoryStore.getState().activeStory;
      return Boolean(story) && route.modes.includes(getMode());
    },
    action: () => {
      const story = useStoryStore.getState().activeStory;
      if (story) navigateTo(storyPath(story.id, route));
    },
  });
  // One command per section (doc 12 D6): grouping pages must not hide where things live, so
  // "characters", "personae" or "world building" each still find their place in one keystroke.
  for (const section of route.sections ?? []) {
    if (section.path === "" && section.label === route.label) continue;
    const { modes, ai } = sectionModes(route, section);
    commandRegistry.register({
      id: `nav-${route.id}-${section.id}`,
      label: `Go to ${section.label}`,
      description: `In the ${route.label}`,
      keywords: [
        "go to",
        "open",
        section.label.toLowerCase(),
        route.label.toLowerCase(),
        ...(section.keywords ?? []),
      ],
      icon: section.icon,
      group: ai ? "AI" : "Navigation",
      when: () => {
        const story = useStoryStore.getState().activeStory;
        return Boolean(story) && modes.includes(getMode()) && (!ai || getAIAvailable());
      },
      action: () => {
        const story = useStoryStore.getState().activeStory;
        if (story) navigateTo(sectionPath(story.id, route.id, section.id));
      },
    });
  }
}

commandRegistry.register({
  id: "nav-dashboard",
  label: "All stories",
  keywords: ["dashboard", "home", "stories", "library"],
  icon: SquareLibrary,
  group: "Navigation",
  action: () => navigateTo("/"),
});

for (const section of SETTINGS_SECTIONS) {
  commandRegistry.register({
    id: `settings-${section.id}`,
    label: `Settings › ${section.label}`,
    keywords: ["settings", "preferences", section.label.toLowerCase(), ...(section.keywords ?? [])],
    icon: section.icon,
    group: section.modes.length === 1 ? "AI" : "Settings",
    when: () => section.modes.includes(getMode()),
    action: () => navigateTo(settingsPath(section)),
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

// ── AI sessions ───────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "open-assistant",
  label: "Open Assistant",
  keywords: ["assistant", "ai", "chat", "help", "feather"],
  icon: Feather,
  group: "AI",
  shortcut: formatCombo(SHORTCUTS.assistant.combo),
  action: async () => {
    const { sessions, createSession, setActiveSession } = useAIStore.getState();
    const { activeStory, activeNode } = useStoryStore.getState();
    const existing = sessions.find((s) => s.type === "assistant");
    if (existing) {
      setActiveSession(existing.id);
      usePanelStore.getState().openAssistant();
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

// ── Editor Actions ────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "editor-writing-coach",
  label: "Writing Coach",
  keywords: ["coach", "feedback", "improve", "write", "prose"],
  icon: Feather,
  group: "Editor",
  shortcut: formatCombo(SHORTCUTS.writingCoach.combo),
  when: () => !!useStoryStore.getState().activeNode,
  action: async () => {
    const { activeStory, activeNode } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    if (!activeStory || !activeNode) return;
    await createSession("writing-coach", { storyId: activeStory.id, nodeId: activeNode.id });
  },
});

commandRegistry.register({
  id: "editor-show-dont-tell",
  label: "Show/Tell Analysis",
  keywords: ["show", "tell", "show dont tell", "analysis", "prose"],
  icon: Compass,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: async () => {
    const { activeStory, activeNode } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    if (!activeStory || !activeNode) return;
    await createSession("show-dont-tell", { storyId: activeStory.id, nodeId: activeNode.id });
  },
});

commandRegistry.register({
  id: "editor-audience",
  label: "Audience Fit",
  keywords: ["audience", "reader", "adherence", "tone"],
  icon: Compass,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: async () => {
    const { activeStory, activeNode } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    if (!activeStory || !activeNode) return;
    await createSession("audience-adherence", { storyId: activeStory.id, nodeId: activeNode.id });
  },
});

commandRegistry.register({
  id: "editor-scene-search",
  label: "Find in Scene",
  keywords: ["find", "search", "replace", "scene"],
  icon: Search,
  group: "Editor",
  shortcut: formatCombo(SHORTCUTS.find.combo),
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openSceneSearch();
  },
});

// Export lived only behind an unlabelled icon inside Manuscript view, and Publish is a
// Studio page, so Writer mode had no findable way out of the app with the manuscript.
commandRegistry.register({
  id: "manuscript-export",
  label: "Export manuscript…",
  keywords: ["export", "download", "docx", "word", "pdf", "epub", "markdown", "txt", "manuscript"],
  icon: Download,
  group: "Manuscript",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    useUIStore.getState().setExportOpen(true);
  },
});

commandRegistry.register({
  id: "editor-story-search",
  label: "Find in Story",
  keywords: ["find", "search", "replace", "story", "all scenes"],
  icon: Search,
  group: "Editor",
  shortcut: formatCombo(SHORTCUTS.storySearch.combo),
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    useUIStore.getState().openStorySearch();
  },
});

commandRegistry.register({
  id: "editor-brainstorm",
  label: "Brainstorm What's Next",
  keywords: ["brainstorm", "next", "idea", "continue"],
  icon: Compass,
  group: "AI",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openBrainstormPanel();
  },
});

commandRegistry.register({
  id: "toggle-ai-panel",
  label: "Show or Hide the Assistant",
  keywords: ["ai", "panel", "assistant", "toggle", "hide", "show"],
  icon: Feather,
  group: "AI",
  shortcut: formatCombo(SHORTCUTS.toggleAIPanel.combo),
  action: () => {
    usePanelStore.getState().toggleAssistant();
  },
});

commandRegistry.register({
  id: "float-ai-panel",
  label: "Float or Dock the Side Panel",
  keywords: ["panel", "float", "dock", "undock", "window", "detach", "tabs"],
  icon: PanelRight,
  group: "View",
  shortcut: formatCombo(SHORTCUTS.floatAIPanel.combo),
  action: () => {
    usePanelStore.getState().toggleFloating();
  },
});

commandRegistry.register({
  id: "editor-story-summary",
  label: "Story So Far",
  keywords: ["summary", "story", "so far", "recap", "catch up"],
  icon: Compass,
  group: "AI",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().toggleStorySummary();
  },
});

commandRegistry.register({
  id: "editor-plan-scene",
  label: "Plan Scene",
  keywords: ["plan", "scene", "outline", "structure"],
  icon: Compass,
  group: "AI",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openPlannerPanel();
  },
});

commandRegistry.register({
  id: "editor-dialogue-insert",
  label: "Insert Dialogue Line",
  keywords: ["dialogue", "dialog", "speaker", "insert", "quote", "attribution"],
  icon: Quote,
  group: "Editor",
  shortcut: "^",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().triggerDialogueInsert();
  },
});

commandRegistry.register({
  id: "editor-dialogue-guide",
  label: "Dialogue Guide",
  keywords: ["dialogue", "dialog", "guide", "syntax", "attribution", "speaker", "help"],
  icon: Quote,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openWritingGuides("dialogue");
  },
});

commandRegistry.register({
  id: "editor-mice-guide",
  label: "MICE Quotient Guide",
  keywords: ["mice", "milieu", "idea", "character", "event", "guide", "quotient", "threads"],
  icon: BookOpen,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openWritingGuides("mice");
  },
});

commandRegistry.register({
  id: "editor-essential-questions-guide",
  label: "6 Essential Questions Guide",
  keywords: ["essential", "questions", "guide", "protagonist", "stakes", "conflict", "arc"],
  icon: BookMarked,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openWritingGuides("essential");
  },
});

commandRegistry.register({
  id: "ai-scene-assistant-from-cmd",
  label: "Scene Assistant",
  keywords: ["scene", "assistant", "ai", "help"],
  icon: Feather,
  group: "AI",
  when: () => !!useStoryStore.getState().activeNode,
  action: async () => {
    const { activeStory, activeNode } = useStoryStore.getState();
    const { createSession } = useAIStore.getState();
    if (!activeStory || !activeNode) return;
    await createSession("scene-assistant", { storyId: activeStory.id, nodeId: activeNode.id });
  },
});
