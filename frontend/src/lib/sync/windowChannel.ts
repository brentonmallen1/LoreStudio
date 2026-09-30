/**
 * A typed BroadcastChannel between this app's windows (refactor doc 11, phase 5).
 *
 * The AI panel had one of its own; the side panel needs the same thing for its tabs when
 * it is popped out, so the mechanics live here once: a window never receives its own
 * broadcast, and a message that cannot be structured-cloned never breaks the app.
 */

/** Identifies this tab, so a window never applies its own broadcast. */
export const WINDOW_ID = Math.random().toString(36).slice(2);

export interface WindowChannel<M extends object> {
  publish: (message: M) => void;
  subscribe: (handler: (message: M & { from: string }) => void) => () => void;
}

export function createWindowChannel<M extends object>(name: string): WindowChannel<M> {
  let channel: BroadcastChannel | null = null;
  function open(): BroadcastChannel | null {
    if (typeof BroadcastChannel === "undefined") return null; // older browsers: no second window, everything else works
    if (!channel) channel = new BroadcastChannel(name);
    return channel;
  }
  return {
    publish(message) {
      const ch = open();
      if (!ch) return;
      try {
        ch.postMessage({ ...message, from: WINDOW_ID });
      } catch {
        // Not cloneable: the windows fall back to being independent.
      }
    },
    subscribe(handler) {
      const ch = open();
      if (!ch) return () => {};
      function onMessage(event: MessageEvent<M & { from: string }>) {
        if (event.data?.from === WINDOW_ID) return;
        handler(event.data);
      }
      ch.addEventListener("message", onMessage);
      return () => ch.removeEventListener("message", onMessage);
    },
  };
}
