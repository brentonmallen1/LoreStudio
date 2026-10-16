import { describe, expect, it } from "vitest";
import { matchSlash, slashCommandsFor } from "./slashCommands";

const names = (format: "prose" | "screenplay" | "stage_play", q: string) =>
  matchSlash(slashCommandsFor(format), q).map((c) => c.name);

describe("slash commands (doc 25, P3½)", () => {
  it("offers prose what the editor already does another way", () => {
    expect(names("prose", "")).toEqual([
      "dialogue",
      "character",
      "note",
      "todo",
      "image",
      "place",
      "help",
      "split",
    ]);
    // A script starts a scene at its heading (doc 25); prose splits at the cursor (doc 29 D6).
    expect(names("screenplay", "split")).toEqual([]);
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

/** The menu teaches the quicker way, and /help opens the Typing guide (doc 26, P2). */
describe("slash commands and the typing helpers", () => {
  const faster = (format: "prose" | "screenplay" | "stage_play", name: string) =>
    slashCommandsFor(format).find((c) => c.name === name)?.faster;

  it("name the quicker way where there is one", () => {
    expect(faster("prose", "dialogue")).toBe("line");
    expect(faster("prose", "character")).toBe("mention");
    expect(faster("prose", "place")).toBe("place");
    expect(faster("prose", "note")).toBe("note");
    expect(faster("prose", "todo")).toBeUndefined();
    expect(faster("screenplay", "heading")).toBe("script-heading");
    expect(faster("stage_play", "heading")).toBe("stage-marker");
    expect(faster("screenplay", "parenthetical")).toBe("script-paren");
  });

  it("offer /help in every format", () => {
    for (const format of ["prose", "screenplay", "stage_play"] as const)
      expect(names(format, "help")).toContain("help");
    expect(names("prose", "shortcuts")).toEqual(["help"]);
  });
});
