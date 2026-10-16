import { useRef, useState } from "react";
import { api } from "../../api/client";
import type { AssistantResult } from "../../api/assistantResults";
import { streamAnswer } from "../../lib/ai/eventStream";
import { useKeptAnswer } from "../ai/kept/useKeptAnswer";

export interface RecapState {
  storyId: string;
  /** What streams in while the Assistant answers. */
  text: string;
  loading: boolean;
  /** The last recap, kept on the story (A7) until cleared or asked again. */
  kept: AssistantResult | null;
  fetch: () => void;
  clear: () => void;
}

/** "Remind me where I left off": an Assistant recap of the last session. Studio only. */
export function useRecap(storyId: string): RecapState {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const kept = useKeptAnswer({ storyId, type: "story", id: storyId }, "session-recap");

  async function fetchRecap() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setLoading(true);
    try {
      const res = await api.recapLastSession(storyId, ctrl.signal);
      if (!res.body) throw new Error("No stream");
      const { error } = await streamAnswer(res, setText);
      // A good recap is kept by the server; show the kept one. Nothing to recap stays said.
      const now = await kept.reload();
      if (error) setText(error);
      else if (now) setText("");
    } catch {
      // An abort, or no model: nothing to show.
    } finally {
      setLoading(false);
    }
  }

  return {
    storyId,
    text,
    loading,
    kept: kept.answer,
    fetch: () => void fetchRecap(),
    clear: () => {
      setText("");
      void kept.clear();
    },
  };
}
