import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DialogueBlock } from "../../../types";
import DialogueLine from "./DialogueLine";

const line = (over: Partial<DialogueBlock>) =>
  ({
    id: "b1",
    content: "Don't open the door.",
    speaker_name: "",
    attribution_method: "unattributed",
    dialogue_type: "speech",
    ...over,
  }) as DialogueBlock;

/** A script's line in the Dialogue thread (doc 25, P4): its direction, and how it is heard. */
const cueLine = (over: Partial<DialogueBlock>): DialogueBlock => ({
  id: "b1",
  scene_id: "s1",
  character_id: "c1",
  speaker_name: "Eleanor Vance",
  content: "The glass never lies.",
  raw_text: "The glass never lies.",
  paragraph_index: 3,
  position_in_paragraph: 0,
  attribution_method: "cue",
  dialogue_type: "speech",
  confidence: 1,
  subtext: null,
  ...over,
});

function show(block: DialogueBlock, unattributed = true) {
  render(
    <DialogueLine
      block={block}
      placed={unattributed ? { side: "centre" as never, runStart: true } : { side: "left", runStart: true }}
      unattributed={unattributed}
      isPov={false}
      speaker={undefined}
      choices={{ inScene: [], rest: [] }}
      tagging={false}
      onTag={vi.fn()}
      onDismiss={vi.fn()}
    />,
  );
}

describe("a line with no speaker in the Dialogue view", () => {
  it("offers to choose who says a spoken line", () => {
    show(line({}));
    expect(screen.queryByText("Who says this?")).not.toBeNull();
  });

  it("names a thought as a thought, with nothing to choose: the prose cannot tag one", () => {
    show(line({ dialogue_type: "thought" }));
    expect(screen.queryByText("A thought")).not.toBeNull();
    expect(screen.queryByText("Who says this?")).toBeNull();
  });
});

describe("DialogueLine in a script", () => {
  it("shows the parenthetical before the line", () => {
    show(cueLine({ direction: "quietly" }), false);
    expect(screen.getByText("(quietly)")).toBeTruthy();
    expect(screen.getByText(/The glass never lies/)).toBeTruthy();
  });

  it("marks a voice-over and a line off screen, and is no guess", () => {
    show(cueLine({ dialogue_type: "voice_over" }), false);
    expect(screen.getByTitle("Voice-over").textContent).toBe("V.O.");
    expect(screen.queryByText("?")).toBeNull();
  });

  it("marks a line off screen", () => {
    show(cueLine({ dialogue_type: "off_screen" }), false);
    expect(screen.getByTitle("Off screen").textContent).toBe("O.S.");
  });
});
