import { stripStoredThoughts } from "../thoughts";
/**
 * Talk — sessions that reflect the author's work back at them.
 * Registered on import; see ./index.ts.
 */
import { Feather, BookOpen, Map } from "lucide-react";
import { registerSessionType } from "../sessionTypes";
import { api } from "../../../api/client";
import { useStoryStore } from "../../../stores/storyStore";

// ── Global Assistant ───────────────────────────────────────────────────────

registerSessionType({
  id: "assistant",
  label: "Assistant",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Assistant: ${names.storyTitle}` : "Assistant"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Assistant",
  icon: Feather,
  accentVar: "--color-ai",
  backendFeatureId: "scene-chat",

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
      session.chronicleSessionId,
      session.mentionedRefs,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: true,
  defaultScope: "current-scene",
  allowedScopes: ["current-scene", "entire-story", "lorebook-only"],
});

// ── Scene Assistant ───────────────────────────────────────────────────────────

function flattenNodes(
  nodes: import("../../../types").StructureNode[],
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
  backendFeatureId: "scene-chat",

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
              // Conversations recorded before reasoning had its own event.
              content: stripStoredThoughts(m.content),
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
      session.chronicleSessionId,
      session.mentionedRefs,
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
  backendFeatureId: "scene-chat",

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
              // Conversations recorded before reasoning had its own event.
              content: stripStoredThoughts(m.content),
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
    return api.sendChatMessage(
      storyId,
      effectiveNodeId,
      session.messages,
      signal,
      llmParams,
      undefined,
      undefined,
      undefined,
      session.mentionedRefs,
    );
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
  backendFeatureId: "writing-coach",

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
    return api.sendChatMessage(
      storyId,
      nodeId,
      session.messages,
      signal,
      llmParams,
      "writing-coach",
      undefined,
      undefined,
      session.mentionedRefs,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Cliche Coach ──────────────────────────────────────────────────────────────

registerSessionType({
  id: "cliche-coach",
  label: "Cliché Coach",
  contextTitle: (_ctx, names) => (names.nodeName ? `Cliché Coach: ${names.nodeName}` : "Cliché Coach"),
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Feather,
  accentVar: "--color-ai",
  backendFeatureId: "cliche-coach",

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
    if (!storyId || !nodeId) throw new Error("Story and scene required for Cliché Coach");
    return api.sendClicheCoachMessage(
      storyId,
      nodeId,
      session.messages,
      selectedText,
      signal,
      llmParams,
      session.mentionedRefs,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});

// ── Story Identity Workshop ───────────────────────────────────────────────────

registerSessionType({
  id: "story-identity-workshop",
  label: "Identity Workshop",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Identity Workshop: ${names.storyTitle}` : "Story Identity Workshop",
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Map,
  accentVar: "--color-ai",
  backendFeatureId: "identity-workshop",

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
    return api.sendIdentityWorkshopMessage(
      storyId,
      session.messages,
      signal,
      llmParams,
      session.mentionedRefs,
    );
  },

  persistsInBackend: false,
  allowContextSwitch: false,
});
