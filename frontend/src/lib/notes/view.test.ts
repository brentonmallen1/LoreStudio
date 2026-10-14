import { beforeEach, describe, expect, it } from "vitest";
import { CARD_ROOM, marginMode, notesShift, readNotesView, saveNotesView } from "./view";

describe("notes view", () => {
  beforeEach(() => localStorage.clear());
  it("reads the old settings and the two views", () => {
    expect(readNotesView()).toBe("cards");
    localStorage.setItem("ls_notes_margin", "on");
    expect(readNotesView()).toBe("cards");
    localStorage.setItem("ls_notes_margin", "off");
    expect(readNotesView()).toBe("dots");
    saveNotesView("cards");
    expect(readNotesView()).toBe("cards");
    saveNotesView("dots");
    expect(readNotesView()).toBe("dots");
  });
  it("falls back to dots when cards have no room", () => {
    expect(marginMode("cards", 300, 180)).toBe("cards");
    expect(marginMode("cards", 100, 180)).toBe("markers");
    expect(marginMode("dots", 300, 180)).toBe("markers");
  });
});

/** The prose is centred, and moves right only while the notes' cards need the room. */
describe("making room for the cards", () => {
  it("moves nothing when the cards fit beside centred prose", () => {
    expect(notesShift(CARD_ROOM, CARD_ROOM + 24, 180)).toBe(0);
  });

  it("moves the prose right by what the cards are short, as far as the space on the right allows", () => {
    expect(notesShift(240, 264, 180)).toBe(CARD_ROOM - 240);
    expect(notesShift(150, 100, 180)).toBe(76);
  });

  it("moves nothing when even then the narrowest card would not fit", () => {
    expect(notesShift(80, 104, 180)).toBe(0);
  });
});
