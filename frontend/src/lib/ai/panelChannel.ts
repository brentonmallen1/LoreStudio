import type { AISession } from "../../stores/aiStore";

/**
 * The link between the main window and the AI panel opened in its own window
 * (doc 06 §2.2, tier 2) — the thing that lets the assistant live on a second screen.
 *
 * Both windows are full clients talking to the same backend; this channel keeps their
 * session lists, active tab and in-flight text in step. A stream belongs to the window
 * that started it — the other renders what arrives and keeps its composer disabled, so a
 * session is never answered twice.
 */
const CHANNEL = "ls-ai";

/** Route for the panel-only window. */
export const AI_WINDOW_PATH = "/ai-window";

/** Sessions cross the channel without their abort controller, which cannot be cloned. */
export type SyncedSession = Omit<AISession, "_abortController">;

export type WindowRole = "main" | "ai-window";

/** What a window says. `from` is stamped on by `publish`. */
export type Outgoing =
  | { kind: "state"; sessions: SyncedSession[]; activeSessionId: string | null }
  | { kind: "delta"; sessionId: string; text: string }
  | { kind: "hello"; role: WindowRole }
  | { kind: "bye"; role: WindowRole };

export type PanelMessage = Outgoing & { from: string };

/** Identifies this tab, so a window never applies its own broadcast. */
export const WINDOW_ID = Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;

function open(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null; // older browsers: no second window, everything else works
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
}

export function publish(message: Outgoing): void {
  const ch = open();
  if (!ch) return;
  try {
    ch.postMessage({ ...message, from: WINDOW_ID });
  } catch {
    // A session that cannot be structured-cloned must not break the app; the windows
    // fall back to being independent.
  }
}

export function subscribe(handler: (message: PanelMessage) => void): () => void {
  const ch = open();
  if (!ch) return () => {};
  function onMessage(event: MessageEvent<PanelMessage>) {
    if (event.data?.from === WINDOW_ID) return;
    handler(event.data);
  }
  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}

/** Strip what cannot cross a structured clone. */
export function toSynced(sessions: AISession[]): SyncedSession[] {
  return sessions.map((s) => {
    const { _abortController, ...rest } = s;
    void _abortController;
    return rest;
  });
}
