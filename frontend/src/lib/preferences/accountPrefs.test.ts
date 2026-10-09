import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateMe = vi.fn((body: unknown) => Promise.resolve(body));
vi.mock("../../api/tools", () => ({ toolsApi: { updateMe: (body: unknown) => updateMe(body) } }));

const { PREFS_ADOPTED_EVENT, adoptAccountPrefs, rememberPref } = await import("./accountPrefs");

describe("the author's choices follow the account", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ls_token", "signed-in");
    updateMe.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps a choice in the browser at once and sends the whole set to the account, batched", () => {
    localStorage.setItem("ls_editor_font", "literata");
    rememberPref("ls_theme", "nord");
    rememberPref("ls_color_mode", "dark");
    expect(localStorage.getItem("ls_theme")).toBe("nord");
    expect(updateMe).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(updateMe).toHaveBeenCalledTimes(1);
    expect(updateMe).toHaveBeenCalledWith({
      settings: { prefs: { ls_theme: "nord", ls_color_mode: "dark", ls_editor_font: "literata" } },
    });
  });

  it("sends nothing when nobody is signed in", () => {
    localStorage.removeItem("ls_token");
    rememberPref("ls_theme", "nord");
    vi.runAllTimers();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it("takes the account's choices where they differ, and says so", () => {
    localStorage.setItem("ls_theme", "zen");
    localStorage.setItem("ls_strip_px", "300"); // a device's own layout: never the account's
    const heard = vi.fn();
    window.addEventListener(PREFS_ADOPTED_EVENT, heard);

    const changed = adoptAccountPrefs({ prefs: { ls_theme: "gruvbox", ls_strip_px: "999", other: 1 } });
    window.removeEventListener(PREFS_ADOPTED_EVENT, heard);

    expect(changed).toBe(true);
    expect(localStorage.getItem("ls_theme")).toBe("gruvbox");
    expect(localStorage.getItem("ls_strip_px")).toBe("300");
    expect(heard).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(updateMe).not.toHaveBeenCalled(); // adopting is not a change to send back
  });

  it("changes nothing when the account and the browser agree", () => {
    localStorage.setItem("ls_theme", "nord");
    expect(adoptAccountPrefs({ prefs: { ls_theme: "nord" } })).toBe(false);
  });

  it("gives an account with no choices yet this browser's", () => {
    localStorage.setItem("ls_ui_scale", "large");
    expect(adoptAccountPrefs({ ui: { mode: "writer" } })).toBe(false);
    vi.runAllTimers();
    expect(updateMe).toHaveBeenCalledWith({ settings: { prefs: { ls_ui_scale: "large" } } });
  });
});
