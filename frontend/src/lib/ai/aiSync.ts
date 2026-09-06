import { useAIStore, type AISession } from "../../stores/aiStore";
import { publish, subscribe, toSynced, type PanelMessage, type WindowRole } from "./panelChannel";

/**
 * Keeps two windows' AI panels in step (doc 06 §2.2, tier 2).
 *
 * Nothing here reaches into the store's actions: it watches the store for changes and
 * republishes them, and applies what other windows send. A window ignores its own
 * broadcasts, and while it is applying a remote update it does not echo it back.
 */
let applying = false;
let started = false;

/** True while another window has the AI panel open — the main window shows a strip. */
export function useOtherWindow(): boolean {
  return useAIStore((s) => s.otherWindowOpen);
}

function applyState(sessions: AISession[], activeSessionId: string | null): void {
  applying = true;
  try {
    // Local abort controllers belong to this window's own streams; keep them.
    const local = new Map(useAIStore.getState().sessions.map((s) => [s.id, s._abortController]));
    useAIStore.setState({
      sessions: sessions.map((s) => ({ ...s, _abortController: local.get(s.id) })),
      activeSessionId,
    });
  } finally {
    applying = false;
  }
}

function onMessage(message: PanelMessage, role: WindowRole): void {
  if (message.kind === "state") {
    applyState(message.sessions as AISession[], message.activeSessionId);
  } else if (message.kind === "delta") {
    applying = true;
    try {
      useAIStore.setState((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === message.sessionId ? { ...sess, streamingText: message.text, isStreaming: true } : sess,
        ),
      }));
    } finally {
      applying = false;
    }
  } else if (message.kind === "hello") {
    // A window just opened: tell it what we have, and note whether it is the AI window.
    publish({
      kind: "state",
      sessions: toSynced(useAIStore.getState().sessions),
      activeSessionId: useAIStore.getState().activeSessionId,
    });
    if (role === "main" && message.role === "ai-window") useAIStore.setState({ otherWindowOpen: true });
  } else if (message.kind === "bye") {
    if (role === "main" && message.role === "ai-window") useAIStore.setState({ otherWindowOpen: false });
  }
}

/**
 * Start syncing this window. Called once per window; returns a teardown for tests.
 */
export function startAISync(role: WindowRole): () => void {
  if (started) return () => {};
  started = true;

  const stopChannel = subscribe((message) => onMessage(message, role));

  let lastSessions = useAIStore.getState().sessions;
  let lastActive = useAIStore.getState().activeSessionId;
  const stopStore = useAIStore.subscribe((state) => {
    if (applying) return;
    const streamingChanged =
      state.sessions.length === lastSessions.length &&
      state.sessions.some((s, i) => s.streamingText !== lastSessions[i]?.streamingText);

    if (streamingChanged) {
      // Deltas are frequent; send only the text that changed.
      state.sessions.forEach((s, i) => {
        if (s.streamingText !== undefined && s.streamingText !== lastSessions[i]?.streamingText) {
          publish({ kind: "delta", sessionId: s.id, text: s.streamingText });
        }
      });
    } else if (state.sessions !== lastSessions || state.activeSessionId !== lastActive) {
      publish({ kind: "state", sessions: toSynced(state.sessions), activeSessionId: state.activeSessionId });
    }
    lastSessions = state.sessions;
    lastActive = state.activeSessionId;
  });

  publish({ kind: "hello", role });
  const sayBye = () => publish({ kind: "bye", role });
  window.addEventListener("beforeunload", sayBye);

  return () => {
    started = false;
    stopChannel();
    stopStore();
    window.removeEventListener("beforeunload", sayBye);
  };
}
