import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { useAIStore as UseAIStore } from "../../stores/aiStore";

/**
 * Two windows, one conversation (doc 06 §2.2, tier 2). BroadcastChannel does not exist in
 * jsdom, so these tests drive the sync module through a minimal stand-in and check the
 * two things that matter: what goes out, and what a window does with what comes in.
 */
type Listener = (event: { data: unknown }) => void;

const sent: unknown[] = [];
let listener: Listener | null = null;

class FakeChannel {
  postMessage(data: unknown) {
    sent.push(data);
  }
  addEventListener(_: string, fn: Listener) {
    listener = fn;
  }
  removeEventListener() {
    listener = null;
  }
}

function session(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "assistant",
    context: {},
    resolvedNames: {},
    messages: [],
    contextLocked: false,
    isStreaming: false,
    createdAt: "2026-09-06T00:00:00Z",
    ...extra,
  };
}

describe("AI panel sync", () => {
  let stop: () => void;
  // The sync module and the store must come from the same freshly-imported graph, or the
  // bridge would be watching a different store than the test drives.
  let useAIStore: typeof UseAIStore;

  beforeEach(async () => {
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    sent.length = 0;
    vi.resetModules();
    ({ useAIStore } = await import("../../stores/aiStore"));
    const { startAISync } = await import("./aiSync");
    useAIStore.setState({ sessions: [], activeSessionId: null });
    stop = startAISync("main");
  });

  afterEach(() => {
    stop?.();
    vi.unstubAllGlobals();
  });

  it("announces itself so an open window can answer with its state", () => {
    expect(sent).toContainEqual(expect.objectContaining({ kind: "hello", role: "main" }));
  });

  it("publishes the session list when it changes", () => {
    useAIStore.setState({ sessions: [session("a")] as never, activeSessionId: "a" });
    const state = sent.filter((m) => (m as { kind: string }).kind === "state").at(-1) as {
      sessions: { id: string }[];
      activeSessionId: string;
    };
    expect(state.sessions.map((s) => s.id)).toEqual(["a"]);
    expect(state.activeSessionId).toBe("a");
  });

  it("sends streamed text as deltas rather than the whole list", () => {
    useAIStore.setState({ sessions: [session("a")] as never });
    sent.length = 0;
    useAIStore.setState({ sessions: [session("a", { streamingText: "Once upon" })] as never });
    expect(sent).toEqual([expect.objectContaining({ kind: "delta", sessionId: "a", text: "Once upon" })]);
  });

  it("applies another window's state without echoing it back", () => {
    sent.length = 0;
    listener?.({
      data: { kind: "state", from: "other", sessions: [session("remote")], activeSessionId: "remote" },
    });
    expect(useAIStore.getState().sessions.map((s) => s.id)).toEqual(["remote"]);
    expect(sent.filter((m) => (m as { kind: string }).kind === "state")).toEqual([]);
  });
});
