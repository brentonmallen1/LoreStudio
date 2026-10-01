import { useMemo } from "react";
import { create } from "zustand";
import { api } from "../api/client";
import { proposalsApi } from "../api/proposals";
import { useAIAvailable } from "../lib/mode";
import type { ActResult, Proposal, ProposalsOut } from "../types/proposals";

/**
 * The Proposals inbox for the open story (doc 12 P5): the page, the rail badge and the
 * place sheets read this one copy. Kept current with the findings by `useFeedSync`.
 */
interface ProposalsStore {
  storyId: string | null;
  data: ProposalsOut | null;
  hidden: string[];
  looking: boolean;
  /** A scene being read by the Assistant for new characters and places. */
  discovering: boolean;
  load: (storyId: string) => Promise<void>;
  refetch: () => Promise<void>;
  act: (p: Proposal, action: string) => Promise<ActResult>;
  decline: (p: Proposal) => Promise<void>;
  lookAgain: (ai: boolean) => Promise<string | null>;
  discoverIn: (storyId: string, nodeId: string) => Promise<void>;
}

export const useProposalsStore = create<ProposalsStore>((set, get) => ({
  storyId: null,
  data: null,
  hidden: [],
  looking: false,
  discovering: false,

  load: async (storyId) => {
    if (get().storyId !== storyId) set({ storyId, data: null, hidden: [] });
    try {
      const data = await proposalsApi.list(storyId);
      if (get().storyId === storyId) set({ data, hidden: [] });
    } catch {
      // A failed read leaves what is on screen.
    }
  },

  refetch: async () => {
    const { storyId, load } = get();
    if (storyId) await load(storyId);
  },

  act: async (p, action) => {
    const { storyId } = get();
    if (!storyId) throw new Error("No story open");
    const result = await proposalsApi.act(storyId, p.id, action);
    // "Tag them" opens the tagging; the proposal stays until the lines have speakers.
    if (!result.open) set((s) => ({ hidden: [...s.hidden, p.id] }));
    void get().refetch();
    return result;
  },

  decline: async (p) => {
    const { storyId } = get();
    if (!storyId) return;
    set((s) => ({ hidden: [...s.hidden, p.id] }));
    try {
      await proposalsApi.decline(storyId, p.id);
    } finally {
      await get().refetch();
    }
  },

  lookAgain: async (ai) => {
    const { storyId } = get();
    if (!storyId) return null;
    set({ looking: true });
    try {
      const { job_id, ...data } = await proposalsApi.lookAgain(storyId, ai);
      if (get().storyId === storyId) set({ data, hidden: [] });
      return job_id;
    } finally {
      set({ looking: false });
    }
  },

  discoverIn: async (storyId, nodeId) => {
    set({ discovering: true });
    try {
      await api.runDiscovery(storyId, nodeId);
      if (get().storyId === storyId) await get().refetch();
    } finally {
      set({ discovering: false });
    }
  },
}));

const EMPTY: Proposal[] = [];

/** The open proposals, minus any just answered. Writer mode has no Assistant, so none of its. */
export function useOpenProposals(): Proposal[] {
  const data = useProposalsStore((s) => s.data);
  const hidden = useProposalsStore((s) => s.hidden);
  const aiAvailable = useAIAvailable();
  return useMemo(
    () =>
      data
        ? data.proposals.filter((p) => !hidden.includes(p.id) && (aiAvailable || p.source !== "ai"))
        : EMPTY,
    [data, hidden, aiAvailable],
  );
}
