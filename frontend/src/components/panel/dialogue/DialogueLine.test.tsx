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

function show(block: DialogueBlock) {
  render(
    <DialogueLine
      block={block}
      placed={{ side: "centre" as never, runStart: true }}
      unattributed
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
