import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../api/client", () => ({
  api: { getLLMSettings: () => Promise.resolve({ thinking_mode: "helps" }) },
}));

import "../lib/ai/sessions/cast";
import "../lib/ai/sessions/talk";
import { useAIStore } from "../stores/aiStore";
import { useSessionThinking } from "./useThinking";

function session(id: string, type: string) {
  return { id, type, messages: [], isStreaming: false, context: {}, createdAt: "" };
}

describe("useSessionThinking", () => {
  it("starts from the feature's default and keeps the author's choice", async () => {
    useAIStore.setState({ sessions: [session("i", "interview"), session("s", "scene-assistant")] as never });
    const interview = renderHook(() => useSessionThinking("i"));
    const scene = renderHook(() => useSessionThinking("s"));
    await waitFor(() => expect(scene.result.current.on).toBe(true));
    expect(interview.result.current.on).toBe(false);

    act(() => interview.result.current.set(true));
    expect(interview.result.current).toMatchObject({ on: true, byDefault: false });
    expect(useAIStore.getState().sessions[0].thinking).toBe(true);

    act(() => interview.result.current.set(false)); // back to its default: no choice kept
    expect(useAIStore.getState().sessions[0].thinking).toBeUndefined();
  });
});
