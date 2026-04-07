/**
 * Concrete session type registrations.
 * Import this module once at app startup (e.g. main.tsx) to register all types.
 */
import { MessageSquare, Feather, BookOpen, Sparkles } from "lucide-react";
import { registerSessionType } from "./sessionTypes";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";

// ── Global Assistant ───────────────────────────────────────────────────────

registerSessionType({
  id: "assistant",
  label: "Assistant",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Assistant — ${names.storyTitle}` : "Assistant",
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
    const { storyId, nodeId } = session.context;
    if (!storyId) {
      return Promise.reject(new Error("Add a story to context before chatting."));
    }
    return api.sendChatMessage(storyId, nodeId ?? "__global__", session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: true,
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

  getDefaultContext: () => ({}),  // No automatic context — must pick a character

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
    const interview = await api.startInterview(
      ctx.characterId,
      `Interview`,
      ctx.nodeId ?? undefined,
    );
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
  contextTitle: (_ctx, names) =>
    names.nodeName ? `Scene: ${names.nodeName}` : "Scene Assistant",
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
            const messages = detail.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
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
    const { storyId, nodeId } = session.context;
    if (!storyId || !nodeId) throw new Error("Story and node required for scene assistant");
    // session.messages already includes the user message appended by aiStore
    return api.sendChatMessage(storyId, nodeId, session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: true,
});

// ── Story Assistant ───────────────────────────────────────────────────────────

registerSessionType({
  id: "story-assistant",
  label: "Story Assistant",
  contextTitle: (_ctx, names) =>
    names.storyTitle ? `Story: ${names.storyTitle}` : "Story Assistant",
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
            const messages = detail.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
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
    const { storyId, nodeId } = session.context;
    if (!storyId) throw new Error("Story required for story assistant");
    // session.messages already includes the user message appended by aiStore
    return api.sendChatMessage(storyId, nodeId ?? "__story__", session.messages, signal, llmParams);
  },

  persistsInBackend: false,
  allowContextSwitch: true,
});

// ── Writing Coach ─────────────────────────────────────────────────────────────

registerSessionType({
  id: "writing-coach",
  label: "Writing Coach",
  contextTitle: (_ctx, names) =>
    names.nodeName ? `Coach: ${names.nodeName}` : "Writing Coach",
  contextItemLabel: (_, names) => names.nodeName ?? "Scene",
  icon: Sparkles,
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
