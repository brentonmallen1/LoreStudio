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
    expect(last).toMatchObject({ kind: "state", activeTabId: "entity:character:c1" });
  });

  it("applies another window's tabs without echoing them", () => {
    const before = sent.length;
    listener?.({
      data: {
        kind: "state",
        from: "other",
        storyId: "s",
        tabs: [
          { id: "scene", kind: "scene" },
          { id: "tool:ideas", kind: "tool", tool: "ideas" },
        ],
        activeTabId: "tool:ideas",
        highlight: null,
      },
    });
    expect(usePanelStore.getState().activeTabId).toBe("tool:ideas");
    expect(sent.length).toBe(before);
  });

  it("notes when the panel is popped out, and takes it back on goodbye", () => {
    listener?.({ data: { kind: "hello", role: "window", from: "other" } });
    expect(usePanelStore.getState().frame).toBe("window");
    expect(sent[sent.length - 1]).toMatchObject({ kind: "state" }); // answered with what we have
    listener?.({ data: { kind: "bye", role: "window", from: "other" } });
    expect(usePanelStore.getState().frame).toBe("docked");
  });
});
