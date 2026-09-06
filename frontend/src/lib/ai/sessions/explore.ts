/**
 * Explore — short labelled options and consequences, never prose.
 * Registered on import; see ./index.ts.
 */
import { Shuffle, Images } from "lucide-react";
import { registerSessionType } from "../sessionTypes";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";

// ── What-If Simulator ─────────────────────────────────────────────────────────

registerSessionType({
  id: "whatif",
  label: "What-If Simulator",
  contextTitle: (_ctx, names) => (names.storyTitle ? `What If — ${names.storyTitle}` : "What-If Simulator"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Shuffle,
  accentVar: "--color-accent-secondary",
  backendFeatureId: "whatif",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
  }),

  getContextItems: () => {
    const { stories } = useStoryStore.getState();
    return stories.map((s) => ({ id: s.id, label: s.title }));
  },

  initSession: async (_ctx) => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId } = session.context;
    if (!storyId) throw new Error("Story required for What-If");
    return api.sendWhatIfMessage(storyId, session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Scene Atmosphere ──────────────────────────────────────────────────────────

registerSessionType({
  id: "scene-atmosphere",
  label: "Scene Atmosphere",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Atmosphere — ${names.storyTitle}` : "Scene Atmosphere"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Images,
  accentVar: "--color-ai",
  backendFeatureId: "scene-atmosphere",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => {
    const { stories } = useStoryStore.getState();
    return stories.map((s) => ({ id: s.id, label: s.title }));
  },

  initSession: async (_ctx) => ({}),

  // Not used — the mode component calls api.analyzeSceneAtmosphere() directly
  sendMessage: () => {
    throw new Error("Scene Atmosphere uses direct API call, not sendMessage");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});
