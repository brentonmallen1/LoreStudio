import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/preferences/accountPrefs", async (original) => ({
  ...(await original<typeof import("../lib/preferences/accountPrefs")>()),
  rememberPref: vi.fn((key: string, value: string) => localStorage.setItem(key, value)),
}));

/** Tips while writing (doc 26, P4): D2 and D3. */
describe("tips", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  async function load() {
    const tips = await import("./tipStore");
    const typing = await import("./typingStore");
    return { ...tips, ...typing };
  }

  it("wait for a pause, and the first one ever says how to turn them off", async () => {
    const { offerTip, useTipStore } = await load();
    offerTip("image");
    expect(useTipStore.getState().showing).toBeNull();
    useTipStore.getState().pause();
    expect(useTipStore.getState().showing).toEqual({ id: "image", first: true });
    expect(localStorage.getItem("ls_tips_seen")).toBe("1");
    offerTip("note");
    useTipStore.getState().pause();
    expect(useTipStore.getState().showing).toEqual({ id: "note", first: false });
  });

  it("come twice a session at most, never the same one twice", async () => {
    const { offerTip, useTipStore, TIPS_A_SESSION } = await load();
    expect(TIPS_A_SESSION).toBe(2);
    offerTip("image");
    useTipStore.getState().pause();
    offerTip("image");
    expect(useTipStore.getState().pending).toBeNull();
    offerTip("note");
    useTipStore.getState().pause();
    offerTip("script-tab");
    expect(useTipStore.getState().pending).toBeNull();
    expect(sessionStorage.getItem("ls_tips_shown")).toBe("image,note");
  });

  it("are only about helpers not yet used, with a long way to save", async () => {
    const { offerTip, markUsed, useTipStore } = await load();
    markUsed("image");
    offerTip("image");
    expect(useTipStore.getState().pending).toBeNull();
    offerTip("place");
    expect(useTipStore.getState().pending).toBeNull();
  });

  it("drop an offer once the writer finds the helper", async () => {
    const { offerTip, markUsed, useTipStore } = await load();
    offerTip("note");
    markUsed("note");
    expect(useTipStore.getState().pending).toBeNull();
  });

  it("stay off once turned off, on the account", async () => {
    const { offerTip, useTipStore } = await load();
    offerTip("note");
    useTipStore.getState().setOn(false);
    expect(useTipStore.getState().pending).toBeNull();
    expect(localStorage.getItem("ls_tips")).toBe("off");
    offerTip("image");
    expect(useTipStore.getState().pending).toBeNull();
  });

  it("are on by default", async () => {
    const { useTipStore } = await load();
    expect(useTipStore.getState().on).toBe(true);
  });
});
