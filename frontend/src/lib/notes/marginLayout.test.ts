import { describe, expect, it } from "vitest";
import { layoutCards } from "./marginLayout";

describe("layoutCards", () => {
  it("puts each card level with its anchor when there is room", () => {
    const tops = layoutCards(
      [
        { id: "a", top: 0 },
        { id: "b", top: 200 },
      ],
      { a: 50, b: 50 },
      8,
    );
    expect(tops).toEqual({ a: 0, b: 200 });
  });

  it("pushes a card down until it clears the one above", () => {
    const tops = layoutCards(
      [
        { id: "b", top: 20 },
        { id: "a", top: 0 },
        { id: "c", top: 30 },
      ],
      { a: 50, b: 40, c: 10 },
      8,
    );
    expect(tops).toEqual({ a: 0, b: 58, c: 106 });
  });

  it("keeps the active card at its anchor and moves earlier cards up", () => {
    const tops = layoutCards(
      [
        { id: "a", top: 100 },
        { id: "b", top: 110 },
        { id: "c", top: 120 },
      ],
      { a: 50, b: 50, c: 50 },
      10,
      "b",
    );
    expect(tops.b).toBe(110);
    expect(tops.a).toBe(110 - 10 - 50);
    expect(tops.c).toBe(110 + 50 + 10);
  });

  it("uses a fallback height for cards not measured yet", () => {
    const tops = layoutCards(
      [
        { id: "a", top: 0 },
        { id: "b", top: 0 },
      ],
      {},
      4,
      null,
      30,
    );
    expect(tops.b).toBe(34);
  });
});
