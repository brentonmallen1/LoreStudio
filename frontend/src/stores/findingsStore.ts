import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { findingsApi } from "../api/findings";
import { MUTATION_EVENT, type MutationEventDetail } from "../api/request";
import { UNDO_APPLIED_EVENT } from "../hooks/useUndoRedo";
import { useAIAvailable } from "../lib/mode";
import { announceScenesRewritten } from "../lib/sceneEvents";
import type { Finding, FindingsOut } from "../types/findings";

/**
 * The findings feed for the open story (doc 12 P4): the Findings page, the This scene
 * card, the sheets' Health cards, the strip's Findings colour and the rail badge all read
 * this one copy. It refetches a moment after any save (the server computes findings, so
 * the client never guesses) and after an undo.
 */
interface FindingsStore {
  storyId: string | null;
  data: FindingsOut | null;
  /** Fingerprints hidden before the server confirms, so a dismissed row leaves at once. */
  hidden: string[];
  runningLocal: boolean;
  load: (storyId: string) => Promise<void>;
  refetch: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  fix: (f: Finding) => Promise<{ node_id: string; replaced: number }>;
  runLocal: () => Promise<void>;
}

export const useFindingsStore = create<FindingsStore>((set, get) => ({
  storyId: null,
  data: null,
  hidden: [],
  runningLocal: false,

  load: async (storyId) => {
    if (get().storyId !== storyId) set({ storyId, data: null, hidden: [] });
    try {
      const data = await findingsApi.list(storyId);
      if (get().storyId === storyId) set({ data, hidden: [] });
    } catch {
      // The feed is advice; a failed read leaves what is on screen.
    }
  },

  refetch: async () => {
    const { storyId, load } = get();
    if (storyId) await load(storyId);
  },

  dismiss: async (id) => {
    const { storyId } = get();
    if (!storyId) return;
    set((s) => ({ hidden: [...s.hidden, id] }));
    try {
      await findingsApi.dismiss(storyId, id);
    } finally {
      await get().refetch();
    }
  },

  restore: async (id) => {
    const { storyId } = get();
    if (!storyId) return;
    await findingsApi.restore(storyId, id);
    await get().refetch();
  },

  fix: async (f) => {
    const { storyId } = get();
    if (!storyId) throw new Error("No story open");
    set((s) => ({ hidden: [...s.hidden, f.id] }));
    try {
      const done = await findingsApi.fix(storyId, f.id);
      // An open editor holds the old text; this makes it take the new.
      announceScenesRewritten([done.node_id]);
      return done;
    } finally {
      await get().refetch();
    }
  },

  runLocal: async () => {
    const { storyId } = get();
    if (!storyId) return;
    set({ runningLocal: true });
    try {
      const data = await findingsApi.runLocal(storyId);
      if (get().storyId === storyId) set({ data, hidden: [] });
    } finally {
      set({ runningLocal: false });
    }
  },
}));

/** The open findings, minus any dismissed a moment ago. Writer mode has no Assistant, so
 * no Assistant findings either. */
export function useOpenFindings(): Finding[] {
  const data = useFindingsStore((s) => s.data);
  const hidden = useFindingsStore((s) => s.hidden);
  const aiAvailable = useAIAvailable();
  return useMemo(
    () =>
      data
        ? data.findings.filter((f) => !hidden.includes(f.id) && (aiAvailable || f.source !== "ai"))
        : EMPTY,
    [data, hidden, aiAvailable],
  );
}

const EMPTY: Finding[] = [];
/** Saves land in bursts (autosave, a sheet's fields); one read after they settle. */
const SETTLE_MS = 1500;

/** Mounted once by the story workspace: load the feed and keep it current. */
export function useFindingsSync(storyId: string | undefined) {
  useEffect(() => {
    if (!storyId) return;
    const { load, refetch } = useFindingsStore.getState();
    void load(storyId);
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refetch(), SETTLE_MS);
    };
    const onMutation = (e: Event) => {
      // The store's own calls refetch themselves.
      if (!(e as CustomEvent<MutationEventDetail>).detail?.path.includes("/findings")) soon();
    };
    window.addEventListener(MUTATION_EVENT, onMutation);
    window.addEventListener(UNDO_APPLIED_EVENT, soon);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(MUTATION_EVENT, onMutation);
      window.removeEventListener(UNDO_APPLIED_EVENT, soon);
    };
  }, [storyId]);
}
