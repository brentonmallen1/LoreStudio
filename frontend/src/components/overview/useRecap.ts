import { useRef, useState } from "react";
import { api } from "../../api/client";
import { streamAnswer } from "../../lib/ai/eventStream";

export interface RecapState {
  text: string;
  loading: boolean;
  done: boolean;
  fetch: () => void;
}

/** "Remind me where I left off": an Assistant recap of the last session. Studio only. */
export function useRecap(storyId: string): RecapState {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function fetchRecap() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setDone(false);
    setLoading(true);
    try {
      const res = await api.recapLastSession(storyId, ctrl.signal);
      if (!res.body) throw new Error("No stream");
      const { error } = await streamAnswer(res, setText);
      if (error) setText(error);
      setDone(true);
    } catch {
      // An abort, or no model: nothing to show.
    } finally {
      setLoading(false);
    }
  }

  return { text, loading, done, fetch: () => void fetchRecap() };
}
