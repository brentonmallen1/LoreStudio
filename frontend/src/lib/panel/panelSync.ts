import { usePanelStore, type Highlight } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import type { PanelTab } from "../../types/panel";
import { liveScene, patchScene } from "../undo/sceneHistory";
import { createWindowChannel } from "../sync/windowChannel";
import { navigateTo } from "../navigation";

/**
 * Keeps the side panel's tabs in step between the main window and the panel popped out
 * into its own window (refactor doc 11, phase 5). Same shape as `aiSync`: watch the store
 * and republish; apply what arrives without echoing it back. The main window shows an
 * "open in another window" strip while the pop-out is alive, and gets the panel back
 * when it says goodbye. The main window also shares the scene its prose has open, so the
 * pop-out's This scene, Notes and Dialogue follow it.
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
  /** From the main window: the scene the prose has open (or none). */
  | { kind: "scene"; node: StructureNode | null }
  /** From the pop-out window: save what is typed in this scene, then say so. */
  | { kind: "save-scene"; nodeId: string; ask: string }
  | { kind: "scene-saved"; ask: string }
  /** The server rewrote a scene (a dialogue tag): lay it into the editor that has it open. */
  | { kind: "scene-rewritten"; node: SceneRewrite }
  | { kind: "bye"; role: PanelRole };

type SceneRewrite = Partial<StructureNode> & { id: string };

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

/** How long the pop-out waits for the main window to save before rewriting anyway. */
const SAVE_WAIT_MS = 3000;
const waiting = new Map<string, () => void>();

/**
 * Save what is typed but not saved in a scene, before the server rewrites it. The editor is
 * in the main window, so from the pop-out window the main window is asked.
 */
export async function saveOpenScene(nodeId: string): Promise<void> {
  const live = liveScene();
  if (live?.nodeId === nodeId) return live.flush();
  if (!started || myRole !== "window") return;
  const ask = Math.random().toString(36).slice(2);
  await new Promise<void>((resolve) => {
    const done = () => {
      waiting.delete(ask);
      resolve();
    };
    waiting.set(ask, done);
    setTimeout(done, SAVE_WAIT_MS); // no main window, or it never answers: go ahead
    channel.publish({ kind: "save-scene", nodeId, ask });
  });
}

/**
 * A scene the server has rewritten, into this window's store and the open editor (outside
 * its history, so the typing around it can still be undone), and into the other window's.
 */
export function layInRewrite(node: SceneRewrite): void {
  applyRewrite(node);
  if (started) channel.publish({ kind: "scene-rewritten", node });
}

function applyRewrite(node: SceneRewrite): void {
  const { activeNode, setActiveNode } = useStoryStore.getState();
  if (activeNode?.id === node.id) setActiveNode({ ...activeNode, ...node });
  const live = liveScene();
  if (live?.nodeId === node.id && node.content) patchScene(live.editor, node.content);
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
      if (role === "main") channel.publish({ kind: "scene", node: useStoryStore.getState().activeNode });
      if (role === "main" && message.role === "window") usePanelStore.getState().setFrame("window");
    } else if (message.kind === "navigate") {
      if (role === "main") navigateTo(message.to);
    } else if (message.kind === "scene") {
      if (role === "window") useStoryStore.getState().setActiveNode(message.node);
    } else if (message.kind === "save-scene") {
      const live = liveScene();
      if (live?.nodeId === message.nodeId) {
        void live.flush().finally(() => channel.publish({ kind: "scene-saved", ask: message.ask }));
      } else if (role === "main") {
        channel.publish({ kind: "scene-saved", ask: message.ask }); // nothing open to save
      }
    } else if (message.kind === "scene-saved") {
      waiting.get(message.ask)?.();
    } else if (message.kind === "scene-rewritten") {
      applyRewrite(message.node);
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

  // The open scene, as it changes (opened, saved, rewritten): only the main window has one.
  let lastNode = useStoryStore.getState().activeNode;
  const stopScene =
    role === "main"
      ? useStoryStore.subscribe((state) => {
          if (state.activeNode === lastNode) return;
          lastNode = state.activeNode;
          channel.publish({ kind: "scene", node: state.activeNode });
        })
      : () => {};

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
    stopScene();
    window.removeEventListener("beforeunload", sayBye);
    window.removeEventListener("pagehide", sayBye);
  };
}
