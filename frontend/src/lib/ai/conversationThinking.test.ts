import { describe, expect, it, vi } from "vitest";

const list = vi.fn();
const get = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock("../../api/client", () => ({
  api: {
    listChronicleSessions: (...a: unknown[]) => list(...a),
    getChronicleSession: (...a: unknown[]) => get(...a),
    updateChronicleSession: (...a: unknown[]) => update(...a),
  },
}));

import { loadThinking, saveThinking } from "./conversationThinking";

describe("conversationThinking", () => {
  it("finds an interview's record by its own id, and a chat's by the record id", async () => {
    list.mockResolvedValue({ sessions: [{ id: "rec-1", thinking: true }] });
    const interview = { type: "interview", backendSessionId: "int-9", context: { storyId: "s1" } };
    expect(await loadThinking(interview)).toBe(true);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ context_type: "interview", context_id: "int-9" }),
    );

    await saveThinking(interview, undefined);
    expect(update).toHaveBeenLastCalledWith("rec-1", { thinking: null });

    get.mockResolvedValue({ thinking: false });
    expect(await loadThinking({ type: "scene-assistant", chronicleSessionId: "rec-2", context: {} })).toBe(
      false,
    );
  });

  it("does nothing for a conversation with no record yet", async () => {
    update.mockClear();
    await saveThinking({ type: "scene-assistant", context: {} }, true);
    expect(update).not.toHaveBeenCalled();
    expect(await loadThinking({ type: "whatif", context: {} })).toBeUndefined();
  });
});
