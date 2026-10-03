import { describe, expect, it } from "vitest";
import type { Character } from "../../types";
import { charactersIn } from "./whoIsInScene";

const cast = (...names: string[]) => names.map((name, i) => ({ id: String(i), name }) as Character);

describe("who is in a scene", () => {
  it("finds names in prose, not inside other words, tags or titles", () => {
    const people = cast(
      "Eleanor Vance",
      "Thomas Vance",
      "The Visitor (Calder)",
      "Al Reyes",
      "Dr. Priya Sharma",
    );
    const text =
      '<p>@Eleanor Vance watched. "Calder," she said. Vance had kept the light. Dr. Who.</p><p class="Thomas">Also</p>';
    expect(charactersIn(text, people).map((c) => c.name)).toEqual(["Eleanor Vance", "The Visitor (Calder)"]);
  });

  it("knows other names", () => {
    const tom = { id: "t", name: "Thomas Vance", aliases: ["Tom"] } as Character;
    expect(charactersIn("<p>Tom’s coat.</p>", [tom])).toEqual([tom]);
  });
});
