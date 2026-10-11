import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import { ScriptElementAttribute } from "./ScriptElementExtension";
import { ScriptGuide } from "./ScriptGuide";

/** The element guides' marks on the line being written (doc 25, P3½). */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function cursorInLine(content: string, index: number, format = "screenplay"): HTMLElement {
  editor = new Editor({
    extensions: [proseStarterKit(), ScriptElementAttribute, ScriptGuide.configure({ format })],
    content,
  });
  let pos = 0;
  editor.state.doc.forEach((_node, offset, i) => {
    if (i === index) pos = offset + 1;
  });
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)));
  return editor.view.dom.children[index] as HTMLElement;
}

describe("element guides", () => {
  it("names the line being written, and hints on an empty one", () => {
    const line = cursorInLine('<p data-el="action">She waits.</p><p data-el="cue"></p>', 1);
    expect(line.classList.contains("el-here")).toBe(true);
    expect(line.dataset.label).toBe("Character");
    expect(line.dataset.hint).toBe("Who speaks, in capitals · Tab for transition");
    expect((editor!.view.dom.children[0] as HTMLElement).classList.contains("el-here")).toBe(false);
  });

  it("names a written line without a hint, in the play's words", () => {
    const line = cursorInLine('<p data-el="action">She waits.</p><p data-el="cue">X</p>', 0, "stage_play");
    expect(line.dataset.label).toBe("Stage direction");
    expect(line.dataset.hint).toBeUndefined();
  });
});
