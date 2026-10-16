import { useEffect, useRef, useState } from "react";
import type { AssistantResult } from "../../../api/assistantResults";
import type { SessionContext } from "../../../lib/ai/sessionTypes";
import type { StructuredResult } from "../../../types";
import { useKeptAnswer } from "./useKeptAnswer";

export interface KeptReading<T> {
  /** The kept reading of this scene or passage, or null. */
  result: T | null;
  answer: AssistantResult | null;
  loading: boolean;
  error: string | null;
  run: () => Promise<void>;
  clear: () => void;
}

/**
 * A reading of prose in an Assistant session (show-don't-tell, audience fit), kept on the
 * scene, or on the story for a passage with no scene, with the passage it read (A7). Opening
 * the session again, or after a restart, shows the kept reading of the same scene or passage;
 * it reads again only on Ask again, or the first time, when nothing is kept.
 */
export function useKeptReading<T>(
  context: SessionContext,
  feature: string,
  ask: () => Promise<StructuredResult>,
  failed: (err: unknown) => string = (e) => (e instanceof Error ? e.message : "Something went wrong."),
): KeptReading<T> {
  const { storyId, nodeId, selectedText } = context;
  const subject = storyId
    ? nodeId
      ? { storyId, type: "node" as const, id: nodeId }
      : { storyId, type: "story" as const, id: storyId }
    : null;
  const kept = useKeptAnswer(subject, feature);
  const passage = (selectedText ?? "").trim();
  const answer = kept.answer && (kept.answer.data.passage ?? "") === passage ? kept.answer : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await ask();
      if (res.success && res.data) await kept.reload();
      else setError(res.raw_text || "Analysis failed. Try again.");
    } catch (e) {
      setError(failed(e));
    } finally {
      setLoading(false);
    }
  }

  // Opening the session reads only when nothing is kept for this scene or passage.
  useEffect(() => {
    if (started.current || !kept.loaded || answer || (!nodeId && !passage)) return;
    started.current = true;
    queueMicrotask(() => void run());
  });

  return {
    result: answer ? (answer.data as unknown as T) : null,
    answer,
    loading,
    error,
    run,
    clear: () => void kept.clear(),
  };
}
