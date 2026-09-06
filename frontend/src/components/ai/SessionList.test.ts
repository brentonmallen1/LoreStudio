import { beforeEach, describe, expect, it } from "vitest";
import "../../lib/ai/sessions";
import { useAIStore, type AISession } from "../../stores/aiStore";
import { sessionLabel } from "../../lib/ai/sessionLabel";

/**
 * The panel's flat tab strip ran out of room at four sessions. Sessions are now grouped
 * the way the AI features are grouped, pinned first and most-recent next (doc 06 §2.1).
 */
function session(id: string, extra: Partial<AISession> = {}): AISession {
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
  } as AISession;
}

describe("session naming and ordering", () => {
  beforeEach(() => useAIStore.setState({ sessions: [], activeSessionId: null }));

  it("prefers the name the author gave a session", () => {
    expect(sessionLabel(session("a", { title: "Elena, on the wreck" }))).toBe("Elena, on the wreck");
  });

  it("falls back to the type's context title", () => {
    expect(sessionLabel(session("a"))).toBe("Assistant");
  });

  it("renaming to blank restores the derived title", () => {
    useAIStore.setState({ sessions: [session("a", { title: "Something" })] });
    useAIStore.getState().renameSession("a", "   ");
    expect(useAIStore.getState().sessions[0].title).toBeUndefined();
  });

  it("activating a session marks it most recent", () => {
    useAIStore.setState({ sessions: [session("a"), session("b")] });
    useAIStore.getState().setActiveSession("b");
    const b = useAIStore.getState().sessions.find((s) => s.id === "b")!;
    expect(b.lastActiveAt).toBeTruthy();
  });

  it("pinning is a toggle", () => {
    useAIStore.setState({ sessions: [session("a")] });
    useAIStore.getState().togglePinned("a");
    expect(useAIStore.getState().sessions[0].pinned).toBe(true);
    useAIStore.getState().togglePinned("a");
    expect(useAIStore.getState().sessions[0].pinned).toBe(false);
  });
});

describe("result sessions", () => {
  beforeEach(() => useAIStore.setState({ sessions: [], activeSessionId: null }));

  it("opens an analysis as a session with the finding attached", () => {
    const created = useAIStore.getState().openResultSession({
      feature: "pacing-analysis",
      heading: "Pacing Analysis",
      data: { summary: "Act two sags." },
      context: { storyId: "s1" },
    });
    expect(created.type).toBe("analysis-result");
    expect(created.result?.data).toEqual({ summary: "Act two sags." });
    // It is the session you are looking at, and its context is fixed to the analysis.
    expect(useAIStore.getState().activeSessionId).toBe(created.id);
    expect(created.contextLocked).toBe(true);
    expect(sessionLabel(created)).toBe("Pacing Analysis");
  });
});

describe("asking again", () => {
  beforeEach(() => useAIStore.setState({ sessions: [], activeSessionId: null }));

  it("drops the answer and re-sends the question", () => {
    const sent: string[] = [];
    useAIStore.setState({
      sessions: [
        session("a", {
          messages: [
            { role: "user", content: "What is she afraid of?" },
            { role: "assistant", content: "A vague answer." },
          ],
        }),
      ],
      sendMessage: ((_id: string, content: string) => sent.push(content)) as never,
    });
    useAIStore.getState().regenerate("a");
    // The question goes back in via sendMessage, so the transcript is left before it.
    expect(useAIStore.getState().sessions[0].messages).toEqual([]);
    expect(sent).toEqual(["What is she afraid of?"]);
  });

  it("does nothing while a reply is still streaming", () => {
    const sent: string[] = [];
    useAIStore.setState({
      sessions: [session("a", { isStreaming: true, messages: [{ role: "user", content: "Hi" }] })],
      sendMessage: ((_id: string, content: string) => sent.push(content)) as never,
    });
    useAIStore.getState().regenerate("a");
    expect(sent).toEqual([]);
  });
});
