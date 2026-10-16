import { describe, expect, it } from "vitest";
import { MAX_CELLS, diffTakes, paragraphsOf, type Side } from "./diff";

/** A side as text, its own words in [brackets]. */
function show(side: Side): string[] {
  return side.map((runs) => runs.map((r) => (r.only ? `[${r.text}]` : r.text)).join(""));
}

describe("comparing two takes", () => {
  it("marks only the words that differ, and nothing when the takes are the same", () => {
    const same = diffTakes(["The knock came twice."], ["The knock came twice."]);
    expect(show(same.a)).toEqual(["The knock came twice."]);
    expect(same.changes).toBe(0);

    const d = diffTakes(
      ["The knock came twice, then a third time."],
      ["The knock came once, then a third time."],
    );
    expect(show(d.a)).toEqual(["The knock came [twice,] then a third time."]);
    expect(show(d.b)).toEqual(["The knock came [once,] then a third time."]);
    expect(d.changes).toBe(1);
  });

  it("marks a reworked passage alone, with the paragraphs around it plain", () => {
    const a = [
      "The knock came.",
      "She opened the door on a woman in a waxed coat.",
      "The woman did not move.",
    ];
    const b = ["The knock came.", "“You’ll be the keeper,” the woman said.", "The woman did not move."];
    const d = diffTakes(a, b);
    expect(show(d.a)).toEqual([
      "The knock came.",
      "[She opened the door on a woman in a waxed coat.]",
      "The woman did not move.",
    ]);
    expect(show(d.b)).toEqual([
      "The knock came.",
      "[“You’ll be the keeper,” the woman said.]",
      "The woman did not move.",
    ]);
  });

  it("keeps a paragraph only one take has to that side", () => {
    const d = diffTakes(["One.", "Three."], ["One.", "Two, new here.", "Three."]);
    expect(show(d.a)).toEqual(["One.", "Three."]);
    expect(show(d.b)).toEqual(["One.", "[Two, new here.]", "Three."]);
    expect(d.changes).toBe(1);
  });

  it("counts each place the takes part", () => {
    const d = diffTakes(["a b c d e f"], ["a x c d y f"]);
    expect(show(d.a)).toEqual(["a [b] c d [e] f"]);
    expect(show(d.b)).toEqual(["a [x] c d [y] f"]);
    expect(d.changes).toBe(2);
  });

  it("compares whole paragraphs when the takes are too different to compare word by word", () => {
    const long = (w: string) =>
      Array.from({ length: Math.ceil(Math.sqrt(MAX_CELLS)) + 10 }, () => w).join(" ");
    const d = diffTakes(["Same start.", long("sea")], ["Same start.", long("salt")]);
    expect(show(d.a)[0]).toBe("Same start.");
    expect(d.a[1]).toEqual([{ text: long("sea"), only: true }]);
    expect(d.b[1]).toEqual([{ text: long("salt"), only: true }]);
  });

  it("reads a take's paragraphs as a reader meets them", () => {
    expect(
      paragraphsOf(
        "<p>The knock <em>came</em>.</p><hr><h2>The Visitor</h2><blockquote><p>Rain.</p></blockquote><p> </p>",
      ),
    ).toEqual(["The knock came.", "The Visitor", "Rain."]);
  });
});
