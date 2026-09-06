/**
 * Analyse — structured findings about text the author wrote.
 * Registered on import; see ./index.ts.
 */
import { Users, Eye, Compass } from "lucide-react";
import { registerSessionType } from "../sessionTypes";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";

// ── Show Don't Tell Analysis ──────────────────────────────────────────────────

registerSessionType({
  id: "show-dont-tell",
  label: "Show Don't Tell",
  contextTitle: (_ctx, names) => (names.nodeName ? `Show/Tell: ${names.nodeName}` : "Show Don't Tell"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Eye,
  accentVar: "--color-ai",
  backendFeatureId: "show-dont-tell",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => [],

  initSession: async (_ctx) => ({}),

  // Not used — the mode component calls api.analyzeShowDontTell() directly on mount
  sendMessage: () => {
    throw new Error("Show Don't Tell uses direct API call, not sendMessage");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Audience Adherence Analysis ───────────────────────────────────────────────

registerSessionType({
  id: "audience-adherence",
  label: "Audience Fit",
  contextTitle: (_ctx, names) => (names.nodeName ? `Audience: ${names.nodeName}` : "Audience Fit"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Users,
  accentVar: "--color-ai",
  backendFeatureId: "audience-adherence",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => [],

  initSession: async (_ctx) => ({}),

  // Not used — the mode component calls api.analyzeAudienceAdherence() directly on mount
  sendMessage: () => {
    throw new Error("Audience Adherence uses direct API call, not sendMessage");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Discovery Questions ────────────────────────────────────────────────────────

registerSessionType({
  id: "discovery-questions",
  label: "Discovery Questions",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Discovery — ${names.storyTitle}` : "Discovery Questions",
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Compass,
  accentVar: "--color-ai",
  backendFeatureId: "discovery-questions",

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

  initSession: async () => ({}),

  // Discovery Questions uses direct API call from the mode component, not sendMessage
  sendMessage: () => {
    throw new Error("Discovery Questions uses direct API call");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Analysis result ───────────────────────────────────────────────────────────
// Not started from the panel's New menu: a page opens one when an analysis returns
// (aiStore.openResultSession), so every AI output has one place to be found.

registerSessionType({
  id: "analysis-result",
  label: "Analysis",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Analysis — ${names.storyTitle}` : "Analysis"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Analysis",
  icon: Compass,
  accentVar: "--color-ai",
  backendFeatureId: "scene-chat",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: false,

  getDefaultContext: (currentView) => ({ storyId: currentView.storyId }),
  getContextItems: () => [],
  initSession: async () => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId } = session.context;
    if (!storyId) return Promise.reject(new Error("This analysis has no story."));
    return api.sendChatMessage(storyId, "__story__", session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: false,
  hiddenFromNewMenu: true,
});
