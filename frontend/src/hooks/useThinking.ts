import { useEffect } from "react";
import { create } from "zustand";
import { api } from "../api/client";
import { MUTATION_EVENT, type MutationEventDetail } from "../api/request";
import { getSessionType } from "../lib/ai/sessionTypes";
import { thinksFor, type ThinkingMode } from "../lib/ai/thinking";
import { useAIStore } from "../stores/aiStore";

/** The author's Thinking choice (Settings › Model parameters), read once and again when it changes. */
const useChoice = create<{ mode: ThinkingMode | undefined }>(() => ({ mode: undefined }));
let watching = false;

function load() {
  api.getLLMSettings().then(
    (s) => useChoice.setState({ mode: s.thinking_mode }),
    () => undefined,
  );
}

function watch() {
  if (watching) return;
  watching = true;
  load();
  window.addEventListener(MUTATION_EVENT, (e) => {
    if ((e as CustomEvent<MutationEventDetail>).detail?.path.startsWith("/llm-settings")) load();
  });
}

/**
 * Whether a conversation's next reply thinks first: its own choice if the author made one
 * (Think first in the composer), else its feature's default under the Settings choice.
 */
export function useSessionThinking(sessionId: string) {
  useEffect(watch, []);
  const mode = useChoice((s) => s.mode);
  const session = useAIStore((s) => s.sessions.find((x) => x.id === sessionId));
  const setThinking = useAIStore((s) => s.setThinking);
  const fallback = thinksFor(
    session ? getSessionType(session.type)?.backendFeatureId : undefined,
    mode ?? "helps",
  );
  const chosen = session?.thinking;
  return {
    on: chosen ?? fallback,
    /** On or off as this conversation's feature would be, with no choice of its own. */
    byDefault: chosen === undefined,
    fallback,
    /** Set this conversation's choice; back to the default clears it. */
    set: (on: boolean) => setThinking(sessionId, on === fallback ? undefined : on),
  };
}
