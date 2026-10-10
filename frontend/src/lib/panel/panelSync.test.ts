import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { usePanelStore as UsePanelStore } from "../../stores/panelStore";

/** Two windows, one set of tabs (doc 11 P5). A stand-in channel, as aiSync.test does. */
type Listener = (event: { data: unknown }) => void;
const sent: Record<string, unknown>[] = [];
let listener: Listener | null = null;

class FakeChannel {
  postMessage(data: Record<string, unknown>) {
    sent.push(data);
  }
  addEventListener(_: string, fn: Listener) {
    listener = fn;
  }
  removeEventListener() {
    listener = null;
  }
}

describe("side panel sync", () => {
  let stop: () => void;
  let usePanelStore: typeof UsePanelStore;

  beforeEach(async () => {
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    sent.length = 0;
    vi.resetModules();
    ({ usePanelStore } = await import("../../stores/panelStore"));
    const { startPanelSync } = await import("./panelSync");
    stop = startPanelSync("main");
  });

  afterEach(() => {
    stop?.();
    vi.unstubAllGlobals();
  });

  it("says hello, then broadcasts tab changes", () => {
    expect(sent[0]).toMatchObject({ kind: "hello", role: "main" });
    usePanelStore.getState().openEntity("character", "c1", "Eleanor");
    const last = sent[sent.length - 1];
    expect(last).toMatchObject({ kind: "state", showing: "entity:character:c1" });
  });

  it("applies another window's tabs without echoing them", () => {
    const before = sent.length;
    listener?.({
      data: {
        kind: "state",
        from: "other",
        storyId: "s",
        tabs: [{ id: "page:storyboard", kind: "page", routeId: "storyboard", path: "/storyboard" }],
        showing: "tool:dialogue",
        highlight: null,
      },
    });
    expect(usePanelStore.getState().showing).toBe("tool:dialogue");
    expect(usePanelStore.getState().tabs.map((t) => t.id)).toEqual(["page:storyboard"]);
    expect(sent.length).toBe(before);
  });

  it("notes when the panel is popped out, and takes it back on goodbye", () => {
    listener?.({ data: { kind: "hello", role: "window", from: "other" } });
    expect(usePanelStore.getState().frame).toBe("window");
    expect(sent.slice(-2).map((m) => m.kind)).toEqual(["state", "scene"]); // answered with what we have
    listener?.({ data: { kind: "bye", role: "window", from: "other" } });
    expect(usePanelStore.getState().frame).toBe("docked");
  });

  it("goes where the pop-out window asks, in the main window", async () => {
    const { setNavigator } = await import("../navigation");
    const go = vi.fn();
    setNavigator(go);
    listener?.({ data: { kind: "navigate", to: "/stories/s/write/n1", from: "other" } });
    expect(go).toHaveBeenCalledWith("/stories/s/write/n1", undefined);
    setNavigator(null);
  });

  it("from the pop-out window, asks the main window to go instead of going itself", async () => {
    stop();
    const { startPanelSync, navigateMain } = await import("./panelSync");
    const { setNavigator } = await import("../navigation");
    const go = vi.fn();
    setNavigator(go);
    stop = startPanelSync("window");
    navigateMain("/stories/s/storyboard");
    expect(go).not.toHaveBeenCalled();
    expect(sent[sent.length - 1]).toMatchObject({ kind: "navigate", to: "/stories/s/storyboard" });
    setNavigator(null);
  });

  it("in the main window, saves the open scene when the pop-out asks, then says so", async () => {
    const { setLiveScene } = await import("../undo/sceneHistory");
    const flush = vi.fn(() => Promise.resolve());
    setLiveScene({ editor: {} as never, nodeId: "n1", title: "Arrival", flush });
    listener?.({ data: { kind: "save-scene", nodeId: "n1", ask: "a1", from: "other" } });
    await vi.waitFor(() => expect(sent[sent.length - 1]).toMatchObject({ kind: "scene-saved", ask: "a1" }));
    expect(flush).toHaveBeenCalledTimes(1);
    setLiveScene(null);
  });

  it("in the main window, takes a rewrite the pop-out made, so the next save is not a conflict", async () => {
    const { useStoryStore } = await import("../../stores/storyStore");
    useStoryStore.setState({ activeNode: { id: "n1", content: "<p>old</p>", updated_at: "t1" } as never });
    listener?.({
      data: {
        kind: "scene-rewritten",
        node: { id: "n1", content: "<p>new</p>", updated_at: "t2" },
        from: "other",
      },
    });
    expect(useStoryStore.getState().activeNode).toMatchObject({ content: "<p>new</p>", updated_at: "t2" });
  });

  it("from the pop-out window, waits for the main window to save before a rewrite", async () => {
    stop();
    const { startPanelSync, saveOpenScene, layInRewrite } = await import("./panelSync");
    stop = startPanelSync("window");
    let saved = false;
    const saving = saveOpenScene("n1").then(() => (saved = true));
    const asked = sent[sent.length - 1] as { kind: string; ask: string };
    expect(asked).toMatchObject({ kind: "save-scene", nodeId: "n1" });
    await Promise.resolve();
    expect(saved).toBe(false);
    listener?.({ data: { kind: "scene-saved", ask: asked.ask, from: "other" } });
    await saving;
    expect(saved).toBe(true);
    layInRewrite({ id: "n1", content: "<p>tagged</p>" });
    expect(sent[sent.length - 1]).toMatchObject({ kind: "scene-rewritten", node: { id: "n1" } });
  });

  it("from the pop-out window, goes ahead if the main window never answers", async () => {
    stop();
    vi.useFakeTimers();
    const { startPanelSync, saveOpenScene } = await import("./panelSync");
    stop = startPanelSync("window");
    const saving = saveOpenScene("n1");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(saving).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("shares the scene the prose has open, so the pop-out's scene tools follow it", async () => {
    const { useStoryStore } = await import("../../stores/storyStore");
    useStoryStore.getState().setActiveNode({ id: "n2", title: "The Light" } as never);
    expect(sent[sent.length - 1]).toMatchObject({ kind: "scene", node: { id: "n2" } });
    listener?.({ data: { kind: "hello", role: "window", from: "other" } });
    expect(sent.filter((m) => m.kind === "scene").length).toBe(2); // answered the hello too

    stop();
    const { startPanelSync } = await import("./panelSync");
    stop = startPanelSync("window");
    listener?.({ data: { kind: "scene", node: { id: "n3", title: "The Logbook" }, from: "other" } });
    expect(useStoryStore.getState().activeNode?.id).toBe("n3");
  });
});
