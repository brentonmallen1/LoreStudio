import { describe, expect, it } from "vitest";
import type { Character } from "../../types";
import { charactersIn, nameForms } from "./whoIsInScene";

const cast = (...names: string[]) => names.map((name, i) => ({ id: String(i), name }) as Character);

describe("who is in a scene", () => {
  it("knows a character by full name, first name and bracketed name", () => {
    expect(nameForms("Eleanor Vance")).toEqual(["Eleanor Vance", "Eleanor"]);
    expect(nameForms("The Visitor (Calder)")).toEqual(["The Visitor", "Calder"]);
    expect(nameForms("Margaret")).toEqual(["Margaret"]);
  });

  it("finds names in prose, not inside other words or tags", () => {
    const people = cast("Eleanor Vance", "Thomas Vance", "The Visitor (Calder)", "Al Reyes");
    const text =
      '<p>@Eleanor Vance watched. "Calder," she said. Vance had kept the light.</p><p class="Thomas">Also</p>';
    expect(charactersIn(text, people).map((c) => c.name)).toEqual(["Eleanor Vance", "The Visitor (Calder)"]);
  });
});
