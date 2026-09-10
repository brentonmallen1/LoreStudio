import { streamAnswer } from "./eventStream";
import { api } from "../../api/client";
import type { AISession } from "../../stores/aiStore";

/** Compact once a conversation passes this many messages, keeping the last few intact. */
const THRESHOLD = 20;
const KEEP = 4;

/**
 * Compact an over-long conversation in the background.
 *
 * Opt-in per session (`autoSummarize`). Failure is silent on purpose: the author asked a
 * question, and a housekeeping task that could not run is not their problem — the
 * conversation simply stays long.
 */
export function maybeAutoSummarize(session: AISession, apply: (summary: string, keep: number) => void): void {
  if (!session.autoSummarize || session.messages.length < THRESHOLD) return;
  const toSummarize = session.messages.slice(0, session.messages.length - KEEP);
  api
    .summarizeConversation(toSummarize, session.context.storyId)
    .then(async (res) => {
      if (!res.ok || !res.body) return;
      const { text, error } = await streamAnswer(res);
      if (!error && text.trim()) apply(text.trim(), KEEP);
    })
    .catch(() => {
      /* see above */
    });
}
