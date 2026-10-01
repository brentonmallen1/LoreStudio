/**
 * Ask the cast — characters answering as themselves.
 * Registered on import; see ./index.ts.
 */
import { MessageSquare, Users } from "lucide-react";
import { registerSessionType } from "../sessionTypes";
import { api } from "../../../api/client";
import { conversationsApi } from "../../../api/conversations";
import { useStoryStore } from "../../../stores/storyStore";

// ── Interview ─────────────────────────────────────────────────────────────────

registerSessionType({
  id: "interview",
  label: "Interview",
  contextTitle: (_ctx, names) =>
    names.characterName ? `Interview with ${names.characterName}` : "Character Interview",
  contextItemLabel: (_, names) => names.characterName ?? "Character",
  icon: MessageSquare,
  accentVar: "--color-accent",
  backendFeatureId: "interview",

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
    const scope = ctx.knowledgeScope ?? (ctx.nodeId ? "as_of" : "profile");
    const interview = await api.startInterview(
      ctx.characterId,
      `Interview`,
      scope === "as_of" ? (ctx.nodeId ?? undefined) : undefined,
      scope,
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
    return api.sendInterviewMessage(
      session.backendSessionId,
      content,
      signal,
      llmParams,
      session.mentionedRefs,
    );
  },

  persistsInBackend: true,
  clearHistory: async (id) => {
    await conversationsApi.clearInterview(id);
  },
  compactHistory: async (id) => {
    const iv = await conversationsApi.compactInterview(id);
    // The latest compaction is the last block of the running summary.
    const summary = (iv.compacted_summary ?? "").split("\n\n---\n\n").pop() ?? "";
    return { summary, keep: iv.messages.length };
  },
  allowContextSwitch: true,
});

// ── Panel Interview ───────────────────────────────────────────────────────────

registerSessionType({
  id: "panel",
  label: "Panel Interview",
  contextTitle: (_ctx, names) => (names.storyTitle ? `Panel — ${names.storyTitle}` : "Panel Interview"),
  contextItemLabel: (_, names) => names.storyTitle ?? "Story",
  icon: Users,
  accentVar: "--color-accent",
  backendFeatureId: "panel-character",

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
    return api.sendPanelMessage(
      session.backendSessionId,
      content,
      signal,
      llmParams,
      undefined,
      session.mentionedRefs,
    );
  },

  // PanelMode holds its own transcript, so it clears and compacts it there (doc 13 P1).
  persistsInBackend: true,
  allowContextSwitch: false,
});
