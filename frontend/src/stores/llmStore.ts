import { create } from "zustand";

export type LLMRequestStatus = "streaming" | "complete" | "error" | "cancelled";
export type TabActivityStatus = "streaming" | "unviewed" | "error" | null;

export interface LLMRequest {
  id: string;
  label: string;
  status: LLMRequestStatus;
  streamedText: string;
  /** Reasoning for this answer, delivered apart from it. */
  streamedThinking: string;
  startedAt: number;
  abortController: AbortController;
  tabId?: string;
  viewed: boolean;
}

interface LLMStore {
  requests: Record<string, LLMRequest>;

  startRequest(id: string, label: string, tabId?: string): AbortController;
  updateStream(id: string, text: string): void;
  updateThinking(id: string, thinking: string): void;
  completeRequest(id: string): void;
  errorRequest(id: string): void;
  cancelRequest(id: string): void;
  clearRequest(id: string): void;
  markViewed(tabId: string): void;

  getRequest(id: string): LLMRequest | undefined;
  getActiveRequests(): LLMRequest[];
  hasActiveRequests(): boolean;
  getTabStatus(tabId: string): TabActivityStatus;
}

const AUTO_CLEAR_MS = 3000;
const UNVIEWED_CLEAR_MS = 5 * 60 * 1000; // 5 minutes

export const useLLMStore = create<LLMStore>((set, get) => ({
  requests: {},

  startRequest(id, label, tabId) {
    // Cancel any existing request with the same id
    const existing = get().requests[id];
    if (existing && existing.status === "streaming") {
      existing.abortController.abort();
    }

    const abortController = new AbortController();
    set((state) => ({
      requests: {
        ...state.requests,
        [id]: {
          id,
          label,
          status: "streaming",
          streamedText: "",
          streamedThinking: "",
          startedAt: Date.now(),
          abortController,
          tabId,
          viewed: false,
        },
      },
    }));
    return abortController;
  },

  updateStream(id, text) {
    set((state) => {
      const req = state.requests[id];
      if (!req) return state;
      return {
        requests: {
          ...state.requests,
          [id]: { ...req, streamedText: text },
        },
      };
    });
  },

  updateThinking(id, thinking) {
    set((state) => {
      const req = state.requests[id];
      if (!req) return state;
      return {
        requests: {
          ...state.requests,
          [id]: { ...req, streamedThinking: thinking },
        },
      };
    });
  },

  completeRequest(id) {
    const req = get().requests[id];
    if (!req) return;
    set((state) => ({
      requests: {
        ...state.requests,
        [id]: { ...state.requests[id], status: "complete" },
      },
    }));
    // If no tabId or already viewed, clear quickly; otherwise wait for user to view
    if (!req.tabId) {
      setTimeout(() => get().clearRequest(id), AUTO_CLEAR_MS);
    } else {
      setTimeout(() => {
        const current = get().requests[id];
        if (current && current.viewed) get().clearRequest(id);
      }, UNVIEWED_CLEAR_MS);
    }
  },

  errorRequest(id) {
    const req = get().requests[id];
    if (!req) return;
    set((state) => ({
      requests: {
        ...state.requests,
        [id]: { ...state.requests[id], status: "error" },
      },
    }));
    if (!req.tabId) {
      setTimeout(() => get().clearRequest(id), AUTO_CLEAR_MS);
    } else {
      setTimeout(() => {
        const current = get().requests[id];
        if (current && current.viewed) get().clearRequest(id);
      }, UNVIEWED_CLEAR_MS);
    }
  },

  cancelRequest(id) {
    const req = get().requests[id];
    if (req) {
      req.abortController.abort();
      set((state) => ({
        requests: {
          ...state.requests,
          [id]: { ...state.requests[id], status: "cancelled" },
        },
      }));
      setTimeout(() => get().clearRequest(id), AUTO_CLEAR_MS);
    }
  },

  clearRequest(id) {
    set((state) => {
      const next = { ...state.requests };
      delete next[id];
      return { requests: next };
    });
  },

  markViewed(tabId) {
    set((state) => {
      const updated: Record<string, LLMRequest> = {};
      let changed = false;
      for (const [id, req] of Object.entries(state.requests)) {
        if (req.tabId === tabId && !req.viewed && req.status !== "streaming") {
          updated[id] = { ...req, viewed: true };
          changed = true;
        } else {
          updated[id] = req;
        }
      }
      return changed ? { requests: updated } : state;
    });
    // Clear viewed requests after a short delay
    setTimeout(() => {
      const reqs = get().requests;
      for (const [id, req] of Object.entries(reqs)) {
        if (req.tabId === tabId && req.viewed) get().clearRequest(id);
      }
    }, AUTO_CLEAR_MS);
  },

  getRequest(id) {
    return get().requests[id];
  },

  getActiveRequests() {
    return Object.values(get().requests).filter((r) => r.status === "streaming");
  },

  hasActiveRequests() {
    return get().getActiveRequests().length > 0;
  },

  getTabStatus(tabId) {
    const reqs = Object.values(get().requests).filter((r) => r.tabId === tabId);
    if (reqs.some((r) => r.status === "streaming")) return "streaming";
    if (reqs.some((r) => r.status === "error" && !r.viewed)) return "error";
    if (reqs.some((r) => r.status === "complete" && !r.viewed)) return "unviewed";
    return null;
  },
}));
