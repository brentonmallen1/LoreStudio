import type { AISession } from "../../stores/aiStore";
import { createWindowChannel } from "../sync/windowChannel";

/**
 * The link between the main window and the assistant opened in its own window
 * (doc 06 §2.2, tier 2) — the thing that lets the assistant live on a second screen.
 *
 * Both windows are full clients talking to the same backend; this channel keeps their
 * session lists, active tab and in-flight text in step. A stream belongs to the window
 * that started it — the other renders what arrives and keeps its composer disabled, so a
 * session is never answered twice.
 */

/** Route for the popped-out side panel (doc 11 P5); `/ai-window` redirects here. */
export const AI_WINDOW_PATH = "/panel-window";

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

const channel = createWindowChannel<Outgoing>("ls-ai");
export const publish = channel.publish;
export const subscribe = channel.subscribe;
export { WINDOW_ID } from "../sync/windowChannel";

/** Strip what cannot cross a structured clone. */
export function toSynced(sessions: AISession[]): SyncedSession[] {
  return sessions.map((s) => {
    const { _abortController, ...rest } = s;
    void _abortController;
    return rest;
  });
}
