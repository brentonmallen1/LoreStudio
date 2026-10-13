import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { currentHeading, headingId, textOf } from "./headings";

describe("headingId", () => {
  it("makes a link-safe id from a heading", () => {
    expect(headingId("Make it comfortable")).toBe("make-it-comfortable");
    expect(headingId("Notes, Freewrite and the scratch pad")).toBe("notes-freewrite-and-the-scratch-pad");
    expect(headingId("  ⌘K: the palette! ")).toBe("k-the-palette");
    expect(headingId("Café")).toBe("cafe");
  });
});

describe("textOf", () => {
  it("reads the words through inline markup", () => {
    const kids = [
      "Type ",
      createElement("code", null, "/note"),
      " or ",
      createElement("strong", null, "Tab"),
    ];
    expect(textOf(kids)).toBe("Type /note or Tab");
  });
});

describe("currentHeading", () => {
  const tops = [
    { id: "a", top: -400 },
    { id: "b", top: 40 },
    { id: "c", top: 600 },
  ];

  it("is the last heading above the line", () => {
    expect(currentHeading(tops, 100)).toBe("b");
    expect(currentHeading(tops, 0)).toBe("a");
  });

  it("is the first before any reaches the line", () => {
    expect(currentHeading([{ id: "a", top: 300 }], 100)).toBe("a");
  });

  it("is the last at the end of the page", () => {
    expect(currentHeading(tops, 100, { height: 800 })).toBe("c");
  });

  it("is the section gone to at the end of the page, while it is in view", () => {
    expect(currentHeading(tops, 100, { height: 800, chosen: "b" })).toBe("b");
    expect(currentHeading(tops, 100, { height: 800, chosen: "a" })).toBe("c");
  });

  it("is nothing without headings", () => {
    expect(currentHeading([], 100)).toBeNull();
  });
});
