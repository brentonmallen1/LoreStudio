import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { proseStarterKit } from "../../components/editor/starterKit";
import { ScriptElementAttribute } from "../../components/editor/script/ScriptElementExtension";
import { makeItTheirLine, spokenInAction } from "./spokenInAction";

/** A line written the prose way in a script's action, made the speaker's on the author's word. */
const NAMES = ["Eleanor Vance", "Eleanor", "The Visitor"];

describe("spokenInAction", () => {
  it.each([
    ['"Run," Eleanor said.', "Eleanor"],
    ["“Run,” said The Visitor.", "The Visitor"],
    ['She turns. Eleanor Vance whispered, "Run."', "Eleanor Vance"],
  ])("finds the speaker of %j", (text, speaker) => {
    expect(spokenInAction(text, NAMES)?.speaker).toBe(speaker);
  });

  it.each(['"Run," the sign says.', '"Run," Eleanor thought.', "Eleanor said nothing.", '"Run"<Eleanor>'])(
    "leaves %j alone",
    (text) => {
      expect(spokenInAction(text, NAMES)).toBeNull();
    },
  );
});

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function convert(text: string): string {
  editor = new Editor({
    extensions: [proseStarterKit(), ScriptElementAttribute],
    content: `<p data-el="action">${text}</p>`,
  });
  const found = spokenInAction(text, NAMES)!;
  const tr = editor.state.tr;
  makeItTheirLine(tr, 1, found);
  editor.view.dispatch(tr);
  return editor.getHTML();
}

describe("makeItTheirLine", () => {
  it("makes the quote dialogue under a cue, the closing comma a full stop", () => {
    expect(convert('"Run," Eleanor said. She grabs the lamp.')).toBe(
      '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Run.</p><p data-el="action">She grabs the lamp.</p>',
    );
  });

  it("keeps the action before a tag that comes first", () => {
    expect(convert('She turns. Eleanor Vance whispered, "Run."')).toBe(
      '<p data-el="action">She turns.</p><p data-el="cue">ELEANOR</p><p data-el="dialogue">Run.</p>',
    );
  });
});
