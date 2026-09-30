import { usePanelStore, type Highlight } from "../../stores/panelStore";
import type { PanelTab } from "../../types/panel";
import { createWindowChannel } from "../sync/windowChannel";

/**
 * Keeps the side panel's tabs in step between the main window and the panel popped out
 * into its own window (refactor doc 11, phase 5). Same shape as `aiSync`: watch the store
 * and republish; apply what arrives without echoing it back. The main window shows an
 * "open in another window" strip while the pop-out is alive, and gets the panel back
 * when it says goodbye.
 */
export type PanelRole = "main" | "window";

type Outgoing =
  | {
      kind: "state";
      storyId: string | null;
      tabs: PanelTab[];
      activeTabId: string;
      highlight: Highlight | null;
    }
  | { kind: "hello"; role: PanelRole }
  | { kind: "bye"; role: PanelRole };

const channel = createWindowChannel<Outgoing>("ls-panel");
let applying = false;
let started = false;

function snapshot(): Outgoing {
  const { storyId, tabs, activeTabId, highlight } = usePanelStore.getState();
  return { kind: "state", storyId, tabs, activeTabId, highlight };
}

export function startPanelSync(role: PanelRole): () => void {
  if (started) return () => {};
  started = true;

  const stopChannel = channel.subscribe((message) => {
    if (message.kind === "state") {
      applying = true;
      try {
        usePanelStore.setState({
          storyId: message.storyId,
          tabs: message.tabs,
          activeTabId: message.activeTabId,
          highlight: message.highlight,
        });
      } finally {
        applying = false;
      }
    } else if (message.kind === "hello") {
      channel.publish(snapshot());
      if (role === "main" && message.role === "window") usePanelStore.getState().setFrame("window");
    } else if (message.kind === "bye") {
      if (role === "main" && message.role === "window") usePanelStore.getState().setFrame("docked");
    }
  });

  let last = usePanelStore.getState();
  const stopStore = usePanelStore.subscribe((state) => {
    if (applying) return;
    if (
      state.tabs !== last.tabs ||
      state.activeTabId !== last.activeTabId ||
      state.highlight !== last.highlight ||
      state.storyId !== last.storyId
    ) {
      channel.publish(snapshot());
    }
    last = state;
  });

  channel.publish({ kind: "hello", role });
  // `pagehide` fires when a window is closed or navigated away from, including cases
  // where `beforeunload` does not; both are cheap, and a second goodbye is harmless.
  const sayBye = () => channel.publish({ kind: "bye", role });
  window.addEventListener("beforeunload", sayBye);
  window.addEventListener("pagehide", sayBye);

  return () => {
    started = false;
    stopChannel();
    stopStore();
    window.removeEventListener("beforeunload", sayBye);
    window.removeEventListener("pagehide", sayBye);
  };
}
