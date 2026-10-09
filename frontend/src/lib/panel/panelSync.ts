import { usePanelStore, type Highlight } from "../../stores/panelStore";
import type { PanelTab } from "../../types/panel";
import { createWindowChannel } from "../sync/windowChannel";
import { navigateTo } from "../navigation";

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
      showing: string;
      highlight: Highlight | null;
    }
  | { kind: "hello"; role: PanelRole }
  /** From the pop-out window: go here in the main window (a page tab's Full page, a card's scene). */
  | { kind: "navigate"; to: string }
  | { kind: "bye"; role: PanelRole };

const channel = createWindowChannel<Outgoing>("ls-panel");
let applying = false;
let started = false;
let myRole: PanelRole = "main";

/**
 * Go somewhere in the app's main window. From the pop-out window that is the other window,
 * asked over the channel; the pop-out itself stays the panel.
 */
export function navigateMain(to: string): void {
  if (started && myRole === "window") channel.publish({ kind: "navigate", to });
  else navigateTo(to);
}

function snapshot(): Outgoing {
  const { storyId, tabs, showing, highlight } = usePanelStore.getState();
  return { kind: "state", storyId, tabs, showing, highlight };
}

export function startPanelSync(role: PanelRole): () => void {
  if (started) return () => {};
  started = true;
  myRole = role;

  const stopChannel = channel.subscribe((message) => {
    if (message.kind === "state") {
      applying = true;
      try {
        usePanelStore.setState({
          storyId: message.storyId,
          tabs: message.tabs,
          showing: message.showing,
          highlight: message.highlight,
        });
      } finally {
        applying = false;
      }
    } else if (message.kind === "hello") {
      channel.publish(snapshot());
      if (role === "main" && message.role === "window") usePanelStore.getState().setFrame("window");
    } else if (message.kind === "navigate") {
      if (role === "main") navigateTo(message.to);
    } else if (message.kind === "bye") {
      if (role === "main" && message.role === "window") usePanelStore.getState().setFrame("docked");
    }
  });

  let last = usePanelStore.getState();
  const stopStore = usePanelStore.subscribe((state) => {
    if (applying) return;
    if (
      state.tabs !== last.tabs ||
      state.showing !== last.showing ||
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
    myRole = "main";
    stopChannel();
    stopStore();
    window.removeEventListener("beforeunload", sayBye);
    window.removeEventListener("pagehide", sayBye);
  };
}
