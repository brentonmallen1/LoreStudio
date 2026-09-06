import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { getAIAvailable, getAIEnabled, getMode } from "./mode";

/**
 * Writer mode hides AI because the mode has no use for it; the master switch hides AI
 * because the author said no (doc 06 §7). Both must render nothing, so every guard reads
 * one function rather than checking the mode and forgetting the switch.
 */
function asUser(settings: Record<string, unknown>) {
  useAuthStore.setState({ user: { id: "u1", username: "u", is_admin: false, settings } as never });
}

describe("AI availability", () => {
  beforeEach(() => asUser({}));

  it("is on by default for an account with no settings", () => {
    expect(getMode()).toBe("studio");
    expect(getAIEnabled()).toBe(true);
    expect(getAIAvailable()).toBe(true);
  });

  it("is off when the switch is off, even in Studio", () => {
    asUser({ ai: { enabled: false } });
    expect(getMode()).toBe("studio");
    expect(getAIAvailable()).toBe(false);
  });

  it("is off in Writer mode, even with the switch on", () => {
    asUser({ ui: { mode: "writer" }, ai: { enabled: true } });
    expect(getAIEnabled()).toBe(true);
    expect(getAIAvailable()).toBe(false);
  });

  it("treats a missing flag as on, not off", () => {
    asUser({ ai: {} });
    expect(getAIEnabled()).toBe(true);
  });
});
