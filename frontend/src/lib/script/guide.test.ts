import { describe, expect, it } from "vitest";
import { keysFrom, lineHint } from "./guide";

describe("the script editor's guide (doc 25, P3½)", () => {
  it("tells an empty line what it is and where Tab takes it", () => {
    expect(lineHint("cue", "screenplay")).toBe("Who speaks, in capitals · Tab for transition");
    expect(lineHint("action", "screenplay")).toBe("What we see happen · Tab for character");
    expect(lineHint("heading", "stage_play")).toBe(
      "SCENE 1, or ACT TWO above an act's first scene · Tab for stage direction",
    );
  });

  it("reads the keys from the tables the editor follows", () => {
    const keys = Object.fromEntries(keysFrom("cue", "screenplay"));
    expect(keys["Enter"]).toBe("next line: dialogue");
    expect(keys["Tab"]).toBe("switch this line to transition");
    expect(keys["Shift-Tab"]).toBe("switch it to action");
    expect(Object.fromEntries(keysFrom("dialogue", "stage_play"))["Tab"]).toBe(
      "switch this line to direction",
    );
  });
});
