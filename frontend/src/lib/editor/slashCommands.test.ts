import { describe, expect, it } from "vitest";
import { matchSlash, slashCommandsFor } from "./slashCommands";

const names = (format: "prose" | "screenplay" | "stage_play", q: string) =>
  matchSlash(slashCommandsFor(format), q).map((c) => c.name);

describe("slash commands (doc 25, P3½)", () => {
  it("offers prose what the editor already does another way", () => {
    expect(names("prose", "")).toEqual(["dialogue", "character", "note", "todo", "image", "place"]);
    expect(slashCommandsFor("prose").find((c) => c.name === "character")!.action).toEqual({
      kind: "type",
      text: "@",
    });
  });

  it("finds a command by a word of its label or a keyword, not only its name", () => {
    expect(names("prose", "speech")).toEqual(["dialogue"]);
    expect(names("prose", "comment")).toEqual(["note"]);
    expect(names("prose", "zzz")).toEqual([]);
  });

  it("puts a script's elements first, named for its format", () => {
    const script = slashCommandsFor("screenplay");
    expect(script.slice(0, 3).map((c) => [c.name, c.label])).toEqual([
      ["heading", "Scene heading"],
      ["action", "Action"],
      ["character", "Character"],
    ]);
    expect(script.find((c) => c.name === "character")!.action).toEqual({ kind: "element", el: "cue" });
    expect(script.find((c) => c.name === "dialogue")!.action).toEqual({ kind: "dialogue" });
    expect(names("screenplay", "slug")).toEqual(["heading"]);
    expect(names("screenplay", "dual")).toEqual(["together"]);
    const play = slashCommandsFor("stage_play");
    expect(play.find((c) => c.name === "action")!.label).toBe("Stage direction");
    expect(names("stage_play", "stage")).toContain("action");
  });
});
