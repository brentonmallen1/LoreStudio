import { useCallback, useEffect, useRef, useState } from "react";
import { assistantResultsApi, type AssistantResult } from "../../../api/assistantResults";
import { backendFeature, type SheetAction, type Subject } from "../../../lib/ai/sheetActions";
import { useAIAvailable } from "../../../lib/mode";
import { toast } from "../../../stores/toastStore";

export interface KeptAnswers {
  answers: AssistantResult[];
  /** The answer open in the band. */
  selected: AssistantResult | null;
  select: (id: string) => void;
  /** The action asking now, by its registry id. */
  running: string | null;
  run: (action: SheetAction) => Promise<void>;
  clear: (id: string) => Promise<void>;
}

/**
 * A sheet's kept Assistant answers (A6): read from the server, so they are there after a
 * remount or a restart; a run replaces the subject's answer for that feature, and Clear
 * deletes it. Nothing is read or run without the Assistant (Writer mode, AI off).
 *
 * The answer belongs to the subject it was asked about: one that comes back after the sheet
 * moved on to another thing is kept by the server and not shown here.
 */
export function useKeptAnswers(subject: Subject | null): KeptAnswers {
  const aiAvailable = useAIAvailable();
  const key = subject && aiAvailable ? `${subject.storyId}|${subject.type}|${subject.id}` : null;
  // Each piece of state carries the subject it is about, so moving to another thing shows
  // nothing of the last one, with no reset to run.
  const [loaded, setLoaded] = useState<{ key: string | null; rows: AssistantResult[] }>({
    key: null,
    rows: [],
  });
  const [pick, setPick] = useState<{ key: string | null; id: string } | null>(null);
  const [busy, setBusy] = useState<{ key: string | null; id: string } | null>(null);
  const current = useRef(key);
  useEffect(() => {
    current.current = key;
  });
  const subjectRef = useRef(subject);
  useEffect(() => {
    subjectRef.current = subject;
  });

  const load = useCallback(async (s: Subject, k: string) => {
    try {
      const rows = await assistantResultsApi.list(s.storyId, s.type, s.id);
      setLoaded((prev) => (current.current === k ? { key: k, rows } : prev));
      return rows;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const s = subjectRef.current;
    if (key && s) void load(s, key);
  }, [key, load]);

  async function run(action: SheetAction) {
    if (!subject || !key || !action.run) return;
    const asked = key;
    setBusy({ key: asked, id: action.id });
    try {
      const result = await action.run();
      if (current.current !== asked) return;
      if (!result.success) {
        toast.error(result.raw_text || "The Assistant could not answer just now.");
        return;
      }
      const rows = await load(subject, asked);
      const made = rows.find((r) => r.feature === backendFeature(action.id));
      if (made) setPick({ key: asked, id: made.id });
    } catch (err) {
      if (current.current === asked)
        toast.error(err instanceof Error ? err.message : "The Assistant could not answer just now.");
    } finally {
      setBusy((b) => (b?.key === asked ? null : b));
    }
  }

  async function clear(id: string) {
    if (!subject) return;
    try {
      await assistantResultsApi.clear(subject.storyId, id);
      setLoaded((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== id) }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The answer could not be cleared.");
    }
  }

  const answers = loaded.key === key ? loaded.rows : [];
  const selectedId = pick?.key === key ? pick.id : null;
  const selected = answers.find((a) => a.id === selectedId) ?? answers[0] ?? null;
  return {
    answers,
    selected,
    select: (id) => setPick({ key, id }),
    running: busy?.key === key ? busy.id : null,
    run,
    clear,
  };
}
