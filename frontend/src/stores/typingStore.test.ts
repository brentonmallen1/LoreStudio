import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/preferences/accountPrefs", async (original) => ({
  ...(await original<typeof import("../lib/preferences/accountPrefs")>()),
  rememberPref: vi.fn((key: string, value: string) => localStorage.setItem(key, value)),
}));

/** The helpers used, kept with the account (doc 26, P1). */
describe("typing store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("keeps each helper once, sorted, under ls_typing_used", async () => {
    const { markUsed, useTypingStore } = await import("./typingStore");
    const { rememberPref } = await import("../lib/preferences/accountPrefs");
    markUsed("line");
    markUsed("mention");
    markUsed("line");
    expect([...useTypingStore.getState().used].sort()).toEqual(["line", "mention"]);
    expect(localStorage.getItem("ls_typing_used")).toBe("line,mention");
    expect(rememberPref).toHaveBeenCalledTimes(2);
  });

  it("reads what the account kept, and drops ids no longer listed", async () => {
    localStorage.setItem("ls_typing_used", "line,gone-helper,place");
    const { useTypingStore } = await import("./typingStore");
    expect([...useTypingStore.getState().used].sort()).toEqual(["line", "place"]);
  });

  it("re-reads when the account's prefs replace the browser's", async () => {
    const { useTypingStore } = await import("./typingStore");
    const { PREFS_ADOPTED_EVENT } = await import("../lib/preferences/accountPrefs");
    localStorage.setItem("ls_typing_used", "slash");
    window.dispatchEvent(new Event(PREFS_ADOPTED_EVENT));
    expect([...useTypingStore.getState().used]).toEqual(["slash"]);
  });
});
