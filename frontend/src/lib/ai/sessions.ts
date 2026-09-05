/**
 * Concrete session type registrations.
 * Import this module once at app startup (e.g. main.tsx) to register all types.
 */
import {
  MessageSquare,
  Feather,
  BookOpen,
  Shuffle,
  Users,
  Eye,
  Images,
  Compass,
  Wand2,
  Map,
} from "lucide-react";
import { registerSessionType } from "./sessionTypes";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";

// ── Global Assistant ───────────────────────────────────────────────────────

registerSessionType({
  id: "assistant",
  label: "Assistant",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Assistant — ${names.storyTitle}` : "Assistant"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Assistant",
  icon: Feather,
  accentVar: "--color-ai",

  requiresStory: false,
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

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId, nodeId, contextScope, contextOptions } = session.context;
    if (!storyId) {
      return Promise.reject(new Error("Add a story to context before chatting."));
    }
    let effectiveNodeId: string;
    if (contextScope === "entire-story") effectiveNodeId = "__story__";
    else if (contextScope === "lorebook-only") effectiveNodeId = "__global__";
    else effectiveNodeId = nodeId ?? "__global__"; // "current-scene" or unset
    return api.sendChatMessage(
      storyId,
      effectiveNodeId,
      session.messages,
      signal,
      llmParams,
      undefined,
      contextOptions,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: true,
  defaultScope: "current-scene",
  allowedScopes: ["current-scene", "entire-story", "lorebook-only"],
});

// ── Interview ─────────────────────────────────────────────────────────────────

registerSessionType({
  id: "interview",
  label: "Interview",
  contextTitle: (_ctx, names) =>
    names.characterName ? `Interview with ${names.characterName}` : "Character Interview",
  contextItemLabel: (_, names) => names.characterName ?? "Character",
  icon: MessageSquare,
  accentVar: "--color-accent",

  requiresStory: false,
  requiresCharacter: true,
  requiresNode: false,

  getDefaultContext: () => ({}), // No automatic context — must pick a character

  getContextItems: async ({ storyId }) => {
    if (!storyId) {
      // Fall back to in-memory characters
      const chars = useStoryStore.getState().characters;
      return chars.map((c) => ({ id: c.id, label: c.name }));
    }
    try {
      const chars = await api.listCharacters(storyId);
      return chars.map((c) => ({ id: c.id, label: c.name }));
    } catch {
      return [];
    }
  },

  initSession: async (ctx) => {
    if (!ctx.characterId) throw new Error("Character required for interview");
    const interview = await api.startInterview(ctx.characterId, `Interview`, ctx.nodeId ?? undefined);
    return {
      backendSessionId: interview.id,
      messages: (interview.messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      interviewNotes: interview.interview_notes ?? undefined,
    };
  },

  sendMessage: (session, content, signal, llmParams) => {
    if (!session.backendSessionId) throw new Error("No interview session");
    return api.sendInterviewMessage(session.backendSessionId, content, signal, llmParams);
  },

  persistsInBackend: true,
  allowContextSwitch: true,
});

// ── Scene Assistant ───────────────────────────────────────────────────────────

function flattenNodes(
  nodes: import("../../types").StructureNode[],
  depth = 0,
): Array<{ id: string; label: string; indent: number }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.title || `(untitled)`, indent: depth },
    ...flattenNodes(n.children ?? [], depth + 1),
  ]);
}

registerSessionType({
  id: "scene-assistant",
  label: "Scene Assistant",
  contextTitle: (_ctx, names) => (names.nodeName ? `Scene: ${names.nodeName}` : "Scene Assistant"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Feather,
  accentVar: "--color-accent-secondary",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: true,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => {
    const { structure } = useStoryStore.getState();
    return flattenNodes(structure);
  },

  initSession: async (ctx) => {
    if (ctx.storyId && ctx.nodeId) {
      try {
        const recent = await api.listChronicleSessions({
          story_id: ctx.storyId,
          context_type: "scene",
          context_id: ctx.nodeId,
          archived: false,
          page_size: 1,
        });
        if (recent.sessions.length > 0) {
          const detail = await api.getChronicleSession(recent.sessions[0].id);
          if (detail.messages.length > 0) {
            const messages = detail.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));
            const firstUser = messages.find((m) => m.role === "user");
            const preview = firstUser
              ? firstUser.content.slice(0, 120) + (firstUser.content.length > 120 ? "…" : "")
              : "Previous conversation";
            return {
              pendingResume: {
                chronicleSessionId: detail.id,
                messages,
                preview,
                messageCount: messages.length,
              },
            };
          }
        }
      } catch {
        // Fall through to fresh session
      }
    }
    return {};
  },

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId, nodeId, contextScope, contextOptions } = session.context;
    if (!storyId || !nodeId) throw new Error("Story and node required for scene assistant");
    const effectiveNodeId = contextScope === "entire-story" ? "__story__" : nodeId;
    return api.sendChatMessage(
      storyId,
      effectiveNodeId,
      session.messages,
      signal,
      llmParams,
      undefined,
      contextOptions,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: true,
  defaultScope: "current-scene",
  allowedScopes: ["current-scene", "entire-story"],
});

// ── Story Assistant ───────────────────────────────────────────────────────────

registerSessionType({
  id: "story-assistant",
  label: "Story Assistant",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Story: ${names.storyTitle}` : "Story Assistant"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: BookOpen,
  accentVar: "--color-accent-tertiary",

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

  initSession: async (ctx) => {
    if (ctx.storyId) {
      try {
        const recent = await api.listChronicleSessions({
          story_id: ctx.storyId,
          context_type: "story",
          context_id: ctx.storyId,
          archived: false,
          page_size: 1,
        });
        if (recent.sessions.length > 0) {
          const detail = await api.getChronicleSession(recent.sessions[0].id);
          if (detail.messages.length > 0) {
            const messages = detail.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));
            const firstUser = messages.find((m) => m.role === "user");
            const preview = firstUser
              ? firstUser.content.slice(0, 120) + (firstUser.content.length > 120 ? "…" : "")
              : "Previous conversation";
            return {
              pendingResume: {
                chronicleSessionId: detail.id,
                messages,
                preview,
                messageCount: messages.length,
              },
            };
          }
        }
      } catch {
        // Fall through to fresh session
      }
    }
    return {};
  },

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId, contextScope } = session.context;
    if (!storyId) throw new Error("Story required for story assistant");
    const effectiveNodeId = contextScope === "lorebook-only" ? "__global__" : "__story__";
    return api.sendChatMessage(storyId, effectiveNodeId, session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: true,
  defaultScope: "entire-story",
  allowedScopes: ["entire-story", "lorebook-only"],
});

// ── Writing Coach ─────────────────────────────────────────────────────────────

registerSessionType({
  id: "writing-coach",
  label: "Writing Coach",
  contextTitle: (_ctx, names) => (names.nodeName ? `Coach: ${names.nodeName}` : "Writing Coach"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Feather,
  accentVar: "--color-ai-coach",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: true,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => {
    const { structure } = useStoryStore.getState();
    return flattenNodes(structure);
  },

  initSession: async (_ctx) => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId, nodeId } = session.context;
    if (!storyId || !nodeId) throw new Error("Story and scene required for writing coach");
    return api.sendChatMessage(storyId, nodeId, session.messages, signal, llmParams, "writing-coach");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Cliche Coach ──────────────────────────────────────────────────────────────

registerSessionType({
  id: "cliche-coach",
  label: "Cliche Coach",
  contextTitle: (_ctx, names) => (names.nodeName ? `Cliche Coach: ${names.nodeName}` : "Cliche Coach"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Feather,
  accentVar: "--color-ai",

  requiresStory: true,
  requiresCharacter: false,
  requiresNode: true,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
    nodeId: currentView.nodeId,
  }),

  getContextItems: () => {
    const { structure } = useStoryStore.getState();
    return flattenNodes(structure);
  },

  initSession: async (_ctx) => ({}),

  sendMessage: (session, _content, signal, llmParams) => {
    const { storyId, nodeId, selectedText } = session.context;
    if (!storyId || !nodeId) throw new Error("Story and scene required for Cliche Coach");
    return api.sendClicheCoachMessage(storyId, nodeId, session.messages, selectedText, signal, llmParams);
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

// ── What-If Simulator ─────────────────────────────────────────────────────────

registerSessionType({
  id: "whatif",
  label: "What-If Simulator",
  contextTitle: (_ctx, names) => (names.storyTitle ? `What If — ${names.storyTitle}` : "What-If Simulator"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Shuffle,
  accentVar: "--color-accent-secondary",

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

// ── Panel Interview ───────────────────────────────────────────────────────────

registerSessionType({
  id: "panel",
  label: "Panel Interview",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Panel — ${names.storyTitle}` : "Panel Interview"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Users,
  accentVar: "--color-accent",

  requiresStory: true,
  requiresCharacter: false, // Multi-character selection is handled within PanelMode
  requiresNode: false,

  getDefaultContext: (currentView) => ({
    storyId: currentView.storyId,
  }),

  getContextItems: async ({ storyId }) => {
    if (!storyId) return [];
    try {
      const chars = await api.listCharacters(storyId);
      return chars.map((c) => ({ id: c.id, label: c.name }));
    } catch {
      return [];
    }
  },

  // Characters are selected in-mode; session starts without a backendSessionId
  initSession: async (_ctx) => ({}),

  sendMessage: (session, content, signal, llmParams) => {
    if (!session.backendSessionId) throw new Error("No panel session");
    return api.sendPanelMessage(session.backendSessionId, content, signal, llmParams);
  },

  persistsInBackend: true,
  allowContextSwitch: false,
});

// ── Show Don't Tell Analysis ──────────────────────────────────────────────────

registerSessionType({
  id: "show-dont-tell",
  label: "Show Don't Tell",
  contextTitle: (_ctx, names) => (names.nodeName ? `Show/Tell: ${names.nodeName}` : "Show Don't Tell"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Eye,
  accentVar: "--color-ai",

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

// ── Book Description Generator ────────────────────────────────────────────────

registerSessionType({
  id: "book-description",
  label: "Book Description",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Book Description — ${names.storyTitle}` : "Book Description",
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Feather,
  accentVar: "--color-ai",

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
    if (!storyId) throw new Error("Story required for Book Description");
    return api.sendBookDescriptionMessage(storyId, session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Query Letter Drafting ─────────────────────────────────────────────────────

registerSessionType({
  id: "query-letter",
  label: "Query Letter",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Query Letter — ${names.storyTitle}` : "Query Letter"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Feather,
  accentVar: "--color-ai",

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
    if (!storyId) throw new Error("Story required for Query Letter");
    return api.sendQueryLetterMessage(storyId, session.messages, signal, llmParams);
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

// ── Story Identity Workshop ───────────────────────────────────────────────────

registerSessionType({
  id: "story-identity-workshop",
  label: "Identity Workshop",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Identity Workshop — ${names.storyTitle}` : "Story Identity Workshop",
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Map,
  accentVar: "--color-ai",

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
    if (!storyId) throw new Error("Story required for Identity Workshop");
    return api.sendIdentityWorkshopMessage(storyId, session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Attribute Generator ───────────────────────────────────────────────────────

registerSessionType({
  id: "attribute-generator",
  label: "Attribute Suggestions",
  contextTitle: (_ctx, names) =>
    names.characterName ? `Attributes — ${names.characterName}` : "Attribute Suggestions",
  contextItemLabel: (_, names) => names.characterName ?? "Character",
  icon: Wand2,
  accentVar: "--color-ai",

  requiresStory: false,
  requiresCharacter: true,
  requiresNode: false,

  getDefaultContext: () => ({}),

  getContextItems: () => {
    const chars = useStoryStore.getState().characters;
    return chars.map((c) => ({ id: c.id, label: c.name }));
  },

  initSession: async (_ctx) => ({}),

  // Not used — the mode component calls api.generateAttributes() directly
  sendMessage: () => {
    throw new Error("Attribute Generator uses direct API call, not sendMessage");
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});
