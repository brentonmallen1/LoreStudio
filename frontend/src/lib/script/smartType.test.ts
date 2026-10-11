import { describe, expect, it } from "vitest";
import { smartComplete } from "./smartType";

const PLACES = ["The Lighthouse", "The Lighthouse, Lamp Room", "Keeper's Cottage"];

describe("SmartType for a script (doc 25, P3½)", () => {
  it("completes a heading: INT. or EXT., the place, the time", () => {
    expect(smartComplete("heading", "I", "screenplay")).toBe("NT. ");
    expect(smartComplete("heading", "EX", "screenplay")).toBe("T. ");
    expect(smartComplete("heading", "INT. KEE", "screenplay", PLACES)).toBe("PER'S COTTAGE");
    expect(smartComplete("heading", "INT. THE L", "screenplay", PLACES)).toBe("IGHTHOUSE");
    expect(smartComplete("heading", "INT. THE LIGHTHOUSE, L", "screenplay", PLACES)).toBe("AMP ROOM");
    expect(smartComplete("heading", "EXT. THE LIGHTHOUSE - N", "screenplay")).toBe("IGHT");
    expect(smartComplete("heading", "EXT. THE LIGHTHOUSE - NIGHT", "screenplay")).toBe("");
    expect(smartComplete("heading", "INT. ", "screenplay", PLACES)).toBe("");
  });

  it("completes a transition and a cue's extension", () => {
    expect(smartComplete("transition", "CU", "screenplay")).toBe("T TO:");
    expect(smartComplete("transition", "DIS", "screenplay")).toBe("SOLVE TO:");
    expect(smartComplete("cue", "ELEANOR (V", "screenplay")).toBe(".O.)");
    expect(smartComplete("cue", "ELEANOR (CO", "screenplay")).toBe("NT'D)");
    expect(smartComplete("cue", "ELEANOR (V.O.)", "screenplay")).toBe("");
    expect(smartComplete("action", "INT", "screenplay")).toBe("");
  });

  it("speaks the theatre's words in a play", () => {
    expect(smartComplete("heading", "SC", "stage_play")).toBe("ENE ");
    expect(smartComplete("transition", "BL", "stage_play")).toBe("ACKOUT.");
  });
});
