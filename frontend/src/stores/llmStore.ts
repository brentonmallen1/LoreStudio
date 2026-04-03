import { create } from "zustand";

export type LLMRequestStatus = "streaming" | "complete" | "error" | "cancelled";

export interface LLMRequest {
  id: string;
  label: string;
  status: LLMRequestStatus;
  streamedText: string;
  startedAt: number;
  abortController: AbortController;
}

interface LLMStore {
  requests: Record<string, LLMRequest>;

  startRequest(id: string, label: string): AbortController;
  updateStream(id: string, text: string): void;
  completeRequest(id: string): void;
  errorRequest(id: string): void;
  cancelRequest(id: string): void;
  clearRequest(id: string): void;

  getRequest(id: string): LLMRequest | undefined;
  getActiveRequests(): LLMRequest[];
  hasActiveRequests(): boolean;
}

const AUTO_CLEAR_MS = 3000;

export const useLLMStore = create<LLMStore>((set, get) => ({
  requests: {},

  startRequest(id, label) {
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
          startedAt: Date.now(),
          abortController,
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

  completeRequest(id) {
    set((state) => {
      const req = state.requests[id];
      if (!req) return state;
      return {
        requests: {
          ...state.requests,
          [id]: { ...req, status: "complete" },
        },
      };
    });
    setTimeout(() => get().clearRequest(id), AUTO_CLEAR_MS);
  },

  errorRequest(id) {
    set((state) => {
      const req = state.requests[id];
      if (!req) return state;
      return {
        requests: {
          ...state.requests,
          [id]: { ...req, status: "error" },
        },
      };
    });
    setTimeout(() => get().clearRequest(id), AUTO_CLEAR_MS);
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

  getRequest(id) {
    return get().requests[id];
  },

  getActiveRequests() {
    return Object.values(get().requests).filter((r) => r.status === "streaming");
  },

  hasActiveRequests() {
    return get().getActiveRequests().length > 0;
  },
}));
