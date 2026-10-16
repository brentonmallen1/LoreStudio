import { useCallback, useEffect, useRef, useState } from "react";
import { assistantResultsApi, type AssistantResult } from "../../../api/assistantResults";
import { announceKept, keptKeyOf, onKept, type KeptKey } from "../../../lib/ai/keptEvents";
import { useAIAvailable } from "../../../lib/mode";
import { toast } from "../../../stores/toastStore";

export interface KeptAnswer {
  /** The kept answer for this thing and feature, or null when there is none. */
  answer: AssistantResult | null;
  /** Whether the server has been asked yet: a surface that runs when nothing is kept waits for it. */
  loaded: boolean;
  /** Read again after a run; resolves to what is kept now. */
  reload: () => Promise<AssistantResult | null>;
  clear: () => Promise<void>;
}

/**
 * One kept Assistant answer outside a sheet (A7): what a Story identity panel, a Plan step,
 * a dialog or an Assistant session shows until it is cleared or asked again, read from the
 * server so it is there after a remount or a restart. The feature route keeps it; this only
 * reads and clears. Nothing is read without the Assistant (Writer mode, AI off).
 */
export function useKeptAnswer(subject: KeptKey | null, feature: string | null): KeptAnswer {
  const aiAvailable = useAIAvailable();
  const key = subject && feature && aiAvailable ? `${keptKeyOf(subject)}|${feature}` : null;
  const [state, setState] = useState<{ key: string | null; answer: AssistantResult | null }>({
    key: null,
    answer: null,
  });
  const ask = useRef<{ key: string | null; subject: KeptKey | null; feature: string | null }>({
    key,
    subject,
    feature,
  });
  useEffect(() => {
    ask.current = { key, subject, feature };
  });

  const reload = useCallback(async () => {
    const { key: k, subject: s, feature: f } = ask.current;
    if (!k || !s || !f) return null;
    try {
      const rows = await assistantResultsApi.list(s.storyId, s.type, s.id);
      const answer = rows.find((r) => r.feature === f) ?? null;
      if (ask.current.key === k) setState({ key: k, answer });
      return answer;
    } catch {
      if (ask.current.key === k) setState({ key: k, answer: null });
      return null;
    }
  }, []);

  useEffect(() => {
    if (key) void reload();
  }, [key, reload]);

  useEffect(() => {
    if (!subject) return;
    const mine = keptKeyOf(subject);
    return onKept((k) => {
      if (k === mine) void reload();
    });
  }, [subject?.storyId, subject?.type, subject?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  async function clear() {
    const answer = state.key === key ? state.answer : null;
    if (!answer || !subject) return;
    try {
      await assistantResultsApi.clear(subject.storyId, answer.id);
      setState({ key, answer: null });
      announceKept(subject);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The answer could not be cleared.");
    }
  }

  return {
    answer: state.key === key ? state.answer : null,
    loaded: key !== null && state.key === key,
    reload,
    clear,
  };
}
