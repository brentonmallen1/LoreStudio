import { create } from "zustand";
import { api } from "../api/client";

/** What the quick check found: is Ollama there, and does it have the model. */
export interface AssistantCheck {
  connected: boolean;
  model: string;
  modelListed: boolean;
  baseUrl: string;
}

export type AssistantStatus = "unknown" | "checking" | "ready" | "not-ready";

/** A "not ready" older than this is checked again when the window comes back into view. */
export const RECHECK_MS = 30_000;
/** And a "ready" older than this, in case Ollama has stopped since. */
export const RECHECK_READY_MS = 5 * 60_000;

interface AssistantSetupState {
  status: AssistantStatus;
  check: AssistantCheck | null;
  checkedAt: number;
  /** The "Set up the Assistant" card, open in a dialog over whatever asked. */
  setupOpen: boolean;
  recheck: () => Promise<AssistantStatus>;
  openSetup: () => void;
  closeSetup: () => void;
}

/**
 * Whether the Assistant can answer (doc 30 D4): Ollama is running and has the chosen model.
 * Asked with the quick check, which never loads the model, once Studio is on and again on
 * Check again; a "not ready" is asked again when the window comes back, so installing Ollama
 * in another window and returning is enough.
 */
export const useAssistantSetup = create<AssistantSetupState>((set) => ({
  status: "unknown",
  check: null,
  checkedAt: 0,
  setupOpen: false,
  recheck: async () => {
    set({ status: "checking" });
    try {
      const s = await api.ollamaStatus(true);
      const check = {
        connected: s.connected,
        model: s.model,
        modelListed: s.model_in_list,
        baseUrl: s.base_url,
      };
      const status = s.connected && s.model_in_list ? "ready" : "not-ready";
      set({ status, check, checkedAt: Date.now() });
      return status;
    } catch {
      // The server itself did not answer: say nothing about the Assistant.
      set({ status: "unknown", checkedAt: Date.now() });
      return "unknown";
    }
  },
  openSetup: () => set({ setupOpen: true }),
  closeSetup: () => set({ setupOpen: false }),
}));

/**
 * The one gate: true when an Assistant action may go ahead. When the last check found no
 * working model, the setup card opens instead and this says no. Before any check has
 * answered it lets the action through, as it always did.
 */
export function requireAssistant(): boolean {
  const { status, openSetup } = useAssistantSetup.getState();
  if (status !== "not-ready") return true;
  openSetup();
  return false;
}
