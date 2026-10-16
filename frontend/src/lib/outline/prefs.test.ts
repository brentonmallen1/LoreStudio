import { afterEach, describe, expect, it, vi } from "vitest";
import { asOrder, asView, loadFolded, loadOrder, loadView, saveFolded, saveOrder, saveView } from "./prefs";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("how the Outline is looked at, per device", () => {
  it("starts as a List, as the reader meets it", () => {
    expect(loadView()).toBe("list");
    expect(loadOrder()).toBe("reader");
  });

  it("remembers the view and the order", () => {
    saveView("cards");
    saveOrder("time");
    expect(loadView()).toBe("cards");
    expect(loadOrder()).toBe("time");
  });

  it("reads only the views and orders there are", () => {
    expect(asView("board")).toBeNull();
    expect(asOrder("reader")).toBe("reader");
    localStorage.setItem("ls_outline_view", "board");
    expect(loadView()).toBe("list");
  });

  it("keeps what is folded for each story", () => {
    saveFolded("s1", new Set(["a1"]));
    expect([...loadFolded("s1")]).toEqual(["a1"]);
    expect(loadFolded("s2").size).toBe(0);
  });

  it("falls back when site data is blocked", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadView()).toBe("list");
    expect(() => saveOrder("time")).not.toThrow();
    expect(loadFolded("s1").size).toBe(0);
  });
});
