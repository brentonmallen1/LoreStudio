import { describe, expect, it } from "vitest";
import { isTutorial, sequelCandidates } from "./sequelOf";

describe("the books a new story can follow", () => {
  it("leaves the tutorial stories out", () => {
    const stories = [
      { id: "a", title: "Learn LoreStudio", genre: "Tutorial" },
      { id: "b", title: "The Last Lighthouse", genre: "Literary" },
      { id: "c", title: "Learn Screenplays", genre: "Tutorial" },
      { id: "d", title: "Untitled", genre: "" },
    ];
    expect(sequelCandidates(stories).map((s) => s.id)).toEqual(["b", "d"]);
    expect(isTutorial({ genre: "Tutorial" })).toBe(true);
  });
});
