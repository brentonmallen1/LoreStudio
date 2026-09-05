import { create } from "zustand";
import type { ChatMessage, LLMParams } from "../types";
import type { SessionContext, ResolvedNames } from "../lib/ai/sessionTypes";
import { getSessionType } from "../lib/ai/sessionTypes";
import { useStoryStore } from "./storyStore";

export interface AISession {
  /** Client-generated unique ID for this tab */
  id: string;
  /** Session type key from SESSION_TYPE_REGISTRY */
  type: string;
  /** Context IDs and resolved data */
  context: SessionContext;
  /** Resolved display names (character name, node title, story title) */
  resolvedNames: ResolvedNames;
  /** Conversation messages */
  messages: ChatMessage[];
  /** Whether the context picker is locked (after first message sent) */
  contextLocked: boolean;
  /** Backend session ID, if the session type creates one (e.g. interview ID) */
  backendSessionId?: string;
  /** Chronicle session ID for persistent history */
  chronicleSessionId?: string;
  /** When true, automatically summarize old messages after crossing a threshold */
  autoSummarize?: boolean;
  /** Interview-specific captured notes */
  interviewNotes?: string;
  /** Currently streaming text (displayed live, not yet in messages) */
  streamingText?: string;
  isStreaming: boolean;
  /** Abort controller for the current streaming request */
  _abortController?: AbortController;
  createdAt: string;
  /** When set, user is asked Continue/Start Fresh before messages are loaded */
  pendingResume?: {
    chronicleSessionId: string;
    messages: import("../types").ChatMessage[];
    preview: string;
    messageCount: number;
  };
}

interface AIStore {
  // ── Panel state ──────────────────────────────────────────────────────────
  panelOpen: boolean;
  panelCollapsed: boolean;

  openPanel: () => void;
  closePanel: () => void;
  collapsePanel: () => void;
  expandPanel: () => void;
  togglePanel: () => void;

  // ── Session management ───────────────────────────────────────────────────
  sessions: AISession[];
  activeSessionId: string | null;

  /**
   * Create a new session and open the panel.
   * Calls sessionType.initSession() to get the backend session ID and initial messages.
   */
  createSession: (type: string, context: SessionContext) => Promise<AISession>;

  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;

  /** Update a session's context (only allowed before contextLocked) */
  updateSessionContext: (id: string, context: Partial<SessionContext>) => void;
  /** Lock the context (called after first message) */
  lockSessionContext: (id: string) => void;

  /** Update interview notes on a session */
  setInterviewNotes: (sessionId: string, notes: string) => void;

  /** Load messages from a pending resume (user chose "Continue") */
  continuePendingResume: (sessionId: string) => void;
  /** Dismiss pending resume, start a fresh session (user chose "Start Fresh") */
  discardPendingResume: (sessionId: string) => void;

  /**
   * Open an already-created backend session (e.g. from StartInterviewDialog).
   * Skips calling initSession — the backend work is already done.
   */
  resumeSession: (
    type: string,
    context: SessionContext,
    backendSessionId: string,
    messages?: import("../types").ChatMessage[],
    interviewNotes?: string,
  ) => Promise<AISession>;

  // ── Messaging ────────────────────────────────────────────────────────────
  /** Add a user message and start streaming the assistant response */
  sendMessage: (sessionId: string, content: string, images?: string[], llmParams?: LLMParams) => void;
  /** Cancel an in-progress streaming response */
  cancelStreaming: (sessionId: string) => void;

  /** Internal: update streaming text */
  _setStreamingText: (sessionId: string, text: string) => void;
  /** Internal: finalize a streamed message */
  _finalizeMessage: (sessionId: string, content: string) => void;
  /** Internal: record a chronicle session ID */
  _setChronicleSessionId: (sessionId: string, chronicleId: string) => void;
  /** Internal: set backend session ID after deferred initialization (e.g. PanelMode character selection) */
  _setBackendSessionId: (sessionId: string, backendSessionId: string) => void;

  /** Clear messages and reset chronicle ID for the session (archive the old one first if desired) */
  startFreshSession: (sessionId: string) => void;

  /**
   * Replace conversation history with a summary message + optional recent messages to keep.
   * The summary is inserted as an assistant message with isSummary: true.
   */
  applySummary: (sessionId: string, summaryText: string, keepRecentCount?: number) => void;

  /** Toggle auto-summarize mode for a session */
  setAutoSummarize: (sessionId: string, enabled: boolean) => void;

  /**
   * Load a Chronicle session into the AI panel.
   * Maps context_type → session type, loads messages, sets chronicleSessionId.
   */
  resumeFromChronicle: (
    chronicleSessionId: string,
    contextType: import("../types").ChronicleSession["context_type"],
    contextId: string | null,
    storyId: string,
    contextLabel: string,
    messages: import("../types").ChatMessage[],
  ) => Promise<AISession>;

  // ── Chronicle helpers ─────────────────────────────────────────────────────
  /** Pending data for creating a Chronicle session on first message */
  _pendingChronicle: Record<
    string,
    { story_id: string; context_type: string; context_id: string; context_label: string }
  >;
}

function makeSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveNames(context: SessionContext): Promise<ResolvedNames> {
  const { characters, stories, structure } = useStoryStore.getState();

  const characterName = context.characterId
    ? characters.find((c) => c.id === context.characterId)?.name
    : undefined;

  const storyTitle = context.storyId ? stories.find((s) => s.id === context.storyId)?.title : undefined;

  function findNodeTitle(nodes: import("../types").StructureNode[], id: string): string | undefined {
    for (const n of nodes) {
      if (n.id === id) return n.title;
      const found = findNodeTitle(n.children ?? [], id);
      if (found) return found;
    }
    return undefined;
  }

  const nodeName = context.nodeId ? findNodeTitle(structure, context.nodeId) : undefined;

  return { characterName, storyTitle, nodeName };
}

export const useAIStore = create<AIStore>((set, get) => ({
  panelOpen: false,
  panelCollapsed: false,

  openPanel: () => set({ panelOpen: true, panelCollapsed: false }),
  closePanel: () => set({ panelOpen: false }),
  collapsePanel: () => set({ panelCollapsed: true }),
  expandPanel: () => set({ panelCollapsed: false, panelOpen: true }),
  togglePanel: () => {
    const { panelOpen, panelCollapsed } = get();
    if (panelCollapsed) {
      set({ panelCollapsed: false, panelOpen: true });
    } else {
      set({ panelOpen: !panelOpen });
    }
  },

  sessions: [],
  activeSessionId: null,
  _pendingChronicle: {},

  createSession: async (type, context) => {
    const sessionType = getSessionType(type);
    if (!sessionType) throw new Error(`Unknown session type: ${type}`);

    const { backendSessionId, messages, interviewNotes, chronicleSessionId, pendingResume } =
      await sessionType.initSession(context);

    const resolvedNames = await resolveNames(context);

    const session: AISession = {
      id: makeSessionId(),
      type,
      context,
      resolvedNames,
      messages: messages ?? [],
      contextLocked: (messages?.length ?? 0) > 0,
      backendSessionId,
      chronicleSessionId,
      interviewNotes,
      isStreaming: false,
      createdAt: new Date().toISOString(),
      pendingResume,
    };

    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
      panelOpen: true,
      panelCollapsed: false,
    }));

    return session;
  },

  closeSession: (id) => {
    set((s) => {
      const sessions = s.sessions.filter((sess) => sess.id !== id);
      let activeSessionId = s.activeSessionId;
      if (activeSessionId === id) {
        activeSessionId = sessions[sessions.length - 1]?.id ?? null;
      }
      return { sessions, activeSessionId };
    });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionContext: (id, contextUpdate) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== id || sess.contextLocked) return sess;
        const context = { ...sess.context, ...contextUpdate };
        // Re-resolve names asynchronously and update
        resolveNames(context).then((resolvedNames) => {
          set((s2) => ({
            sessions: s2.sessions.map((s3) => (s3.id === id ? { ...s3, resolvedNames } : s3)),
          }));
        });
        return { ...sess, context };
      }),
    }));
  },

  lockSessionContext: (id) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, contextLocked: true } : sess)),
    }));
  },

  setInterviewNotes: (sessionId, notes) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, interviewNotes: notes } : sess)),
    }));
  },

  continuePendingResume: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId || !sess.pendingResume) return sess;
        return {
          ...sess,
          messages: sess.pendingResume.messages,
          chronicleSessionId: sess.pendingResume.chronicleSessionId,
          contextLocked: true,
          pendingResume: undefined,
        };
      }),
    }));
  },

  discardPendingResume: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, pendingResume: undefined } : sess,
      ),
    }));
  },

  resumeSession: async (type, context, backendSessionId, messages, interviewNotes) => {
    const resolvedNames = await resolveNames(context);

    const session: AISession = {
      id: makeSessionId(),
      type,
      context,
      resolvedNames,
      messages: messages ?? [],
      contextLocked: (messages?.length ?? 0) > 0,
      backendSessionId,
      interviewNotes,
      isStreaming: false,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
      panelOpen: true,
      panelCollapsed: false,
    }));

    return session;
  },

  sendMessage: (sessionId, content, images, llmParams) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.isStreaming) return;

    const sessionType = getSessionType(session.type);
    if (!sessionType) return;

    // Lock context on first message
    if (!session.contextLocked) {
      get().lockSessionContext(sessionId);
    }

    const userMessage: ChatMessage = { role: "user", content, ...(images?.length ? { images } : {}) };

    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, messages: [...sess.messages, userMessage], isStreaming: true, streamingText: "" }
          : sess,
      ),
    }));

    // Stream the response
    const abortController = new AbortController();

    // Store controller so cancelStreaming() can abort it
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, _abortController: abortController } : sess,
      ),
    }));

    const updatedSession = get().sessions.find((s) => s.id === sessionId)!;

    sessionType
      .sendMessage(
        {
          backendSessionId: updatedSession.backendSessionId,
          context: updatedSession.context,
          messages: updatedSession.messages,
        },
        content,
        abortController.signal,
        llmParams,
      )
      .then(async (res) => {
        if (!res.ok || !res.body) {
          get()._finalizeMessage(sessionId, "⚠ Error reaching LLM.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          get()._setStreamingText(sessionId, full);
        }

        get()._finalizeMessage(sessionId, full);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          get()._finalizeMessage(sessionId, "⚠ Error reaching LLM.");
        } else {
          // On abort, finalize with whatever was streamed so far
          const partial = get().sessions.find((s) => s.id === sessionId)?.streamingText ?? "";
          get()._finalizeMessage(sessionId, partial || "⚠ Response cancelled.");
        }
      });
  },

  cancelStreaming: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    session?._abortController?.abort();
  },

  _setStreamingText: (sessionId, text) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, streamingText: text } : sess)),
    }));
  },

  _finalizeMessage: (sessionId, content) => {
    const AUTO_SUMMARIZE_THRESHOLD = 20;
    const AUTO_SUMMARIZE_KEEP = 4;

    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        return {
          ...sess,
          messages: [...sess.messages, { role: "assistant" as const, content }],
          streamingText: undefined,
          isStreaming: false,
          _abortController: undefined,
        };
      }),
    }));

    // Trigger background auto-summarize if enabled and threshold exceeded
    const sess = get().sessions.find((s) => s.id === sessionId);
    if (sess?.autoSummarize && sess.messages.length >= AUTO_SUMMARIZE_THRESHOLD) {
      const toSummarize = sess.messages.slice(0, sess.messages.length - AUTO_SUMMARIZE_KEEP);
      import("../api/client").then(({ api }) => {
        api
          .summarizeConversation(toSummarize, sess.context.storyId)
          .then(async (res) => {
            if (!res.ok || !res.body) return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let full = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              full += decoder.decode(value, { stream: true });
            }
            if (full.trim()) {
              get().applySummary(sessionId, full.trim(), AUTO_SUMMARIZE_KEEP);
            }
          })
          .catch(() => {
            /* silent fail */
          });
      });
    }
  },

  _setChronicleSessionId: (sessionId, chronicleId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, chronicleSessionId: chronicleId } : sess,
      ),
    }));
  },

  _setBackendSessionId: (sessionId, backendSessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, backendSessionId } : sess)),
    }));
  },

  startFreshSession: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              messages: [],
              chronicleSessionId: undefined,
              contextLocked: false,
              streamingText: undefined,
            }
          : sess,
      ),
    }));
  },

  applySummary: (sessionId, summaryText, keepRecentCount = 4) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const summaryMsg: import("../types").ChatMessage = {
          role: "assistant",
          content: summaryText,
          isSummary: true,
        };
        const recent = keepRecentCount > 0 ? sess.messages.slice(-keepRecentCount) : [];
        return { ...sess, messages: [summaryMsg, ...recent] };
      }),
    }));
  },

  setAutoSummarize: (sessionId, enabled) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, autoSummarize: enabled } : sess,
      ),
    }));
  },

  resumeFromChronicle: async (
    chronicleSessionId,
    contextType,
    contextId,
    storyId,
    _contextLabel,
    messages,
  ) => {
    const typeMap: Record<string, string> = {
      scene: "scene-assistant",
      story: "story-assistant",
      character: "interview",
      panel: "panel",
    };
    const sessionType = typeMap[contextType] ?? "scene-assistant";

    const context: SessionContext = {
      storyId,
      nodeId: contextType === "scene" ? (contextId ?? undefined) : undefined,
      characterId: contextType === "character" ? (contextId ?? undefined) : undefined,
    };

    const resolvedNames = await resolveNames(context);

    const session: AISession = {
      id: makeSessionId(),
      type: sessionType,
      context,
      resolvedNames,
      messages,
      contextLocked: messages.length > 0,
      chronicleSessionId,
      isStreaming: false,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
      panelOpen: true,
      panelCollapsed: false,
    }));

    return session;
  },
}));
