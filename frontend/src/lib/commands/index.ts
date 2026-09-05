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
  Compass,
  Eye,
  Activity,
  Search,
  Quote,
  BookMarked,
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
  action: () => {
    window.location.href = "/settings";
  },
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

// ── Editor Actions ────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "editor-writing-coach",
  label: "Writing Coach",
  keywords: ["coach", "feedback", "improve", "write", "prose"],
  icon: Feather,
  group: "Editor",
  shortcut: "⌘⇧R",
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
  shortcut: "⌘⇧T",
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
  shortcut: "⌘⇧A",
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
  shortcut: "⌘F",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openSceneSearch();
  },
});

commandRegistry.register({
  id: "editor-story-search",
  label: "Find in Story",
  keywords: ["find", "search", "replace", "story", "all scenes"],
  icon: Search,
  group: "Editor",
  shortcut: "⌘⇧F",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    useUIStore.getState().openStorySearch();
  },
});

commandRegistry.register({
  id: "editor-brainstorm",
  label: "Brainstorm What's Next",
  keywords: ["brainstorm", "next", "idea", "continue"],
  icon: Feather,
  group: "Editor",
  when: () => !!useStoryStore.getState().activeNode,
  action: () => {
    useUIStore.getState().openBrainstormPanel();
  },
});

commandRegistry.register({
  id: "editor-plan-scene",
  label: "Plan Scene",
  keywords: ["plan", "scene", "outline", "structure"],
  icon: BookOpen,
  group: "Editor",
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

// ── Story Health ──────────────────────────────────────────────────────────────

commandRegistry.register({
  id: "health-run-all",
  label: "Story Health Dashboard",
  keywords: ["health", "analysis", "run all", "check", "pacing", "prose"],
  icon: Activity,
  group: "Health",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) window.location.href = `/stories/${story.id}/health`;
  },
});

commandRegistry.register({
  id: "health-discoveries",
  label: "NLP Discoveries",
  keywords: ["nlp", "discovery", "entities", "auto-link"],
  icon: Eye,
  group: "Health",
  when: () => !!useStoryStore.getState().activeStory,
  action: () => {
    const story = useStoryStore.getState().activeStory;
    if (story) window.location.href = `/stories/${story.id}/discoveries`;
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
