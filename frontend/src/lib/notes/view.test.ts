import { beforeEach, describe, expect, it } from "vitest";
import { marginMode, readNotesView, saveNotesView } from "./view";

describe("notes view", () => {
  beforeEach(() => localStorage.clear());
  it("reads the old on/off setting and the new views", () => {
    expect(readNotesView()).toBe("cards");
    localStorage.setItem("ls_notes_margin", "on");
    expect(readNotesView()).toBe("cards");
    localStorage.setItem("ls_notes_margin", "off");
    expect(readNotesView()).toBe("off");
    saveNotesView("dots");
    expect(readNotesView()).toBe("dots");
  });
  it("falls back to dots when cards have no room", () => {
    expect(marginMode("cards", 300, 180)).toBe("cards");
    expect(marginMode("cards", 100, 180)).toBe("markers");
    expect(marginMode("dots", 300, 180)).toBe("markers");
    expect(marginMode("off", 300, 180)).toBe("none");
  });
});
