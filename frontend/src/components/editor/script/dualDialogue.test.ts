import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import { docBlocks, ScriptElementAttribute } from "./ScriptElementExtension";
import { toggleDual } from "./dualDialogue";

/**
 * Two speeches at once (doc 25, P8): "Speak at the same time" marks the cue of the speech the
 * cursor is in, when it follows another speech; the page count reads it the Fountain way.
 */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const BRICK = '<p data-el="cue">BRICK</p><p data-el="dialogue">Screw retirement.</p>';
const STEEL = '<p data-el="cue">STEEL</p><p data-el="dialogue">Screw it.</p>';

function cursorIn(content: string, needle: string): Editor {
  editor = new Editor({ extensions: [proseStarterKit(), ScriptElementAttribute], content });
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(needle)) at = pos + 1;
    return at < 0;
  });
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)));
  return editor;
}

describe("speak at the same time", () => {
  it("marks the cue of the speech the cursor is in, and unmarks it", () => {
    const ed = cursorIn(BRICK + STEEL, "Screw it");
    expect(toggleDual(ed)).toBe("on");
    expect(ed.getHTML()).toContain('<p data-el="cue" data-dual="true">STEEL</p>');
    expect(docBlocks(ed.state.doc)[2]).toEqual(["cue", "STEEL ^"]);
    expect(toggleDual(ed)).toBe("off");
    expect(ed.getHTML()).not.toContain("data-dual");
  });

  it("needs a speech straight before it", () => {
    expect(toggleDual(cursorIn(BRICK, "Screw"))).toBe("none");
    editor?.destroy();
    const between = '<p data-el="action">He sits.</p>';
    expect(toggleDual(cursorIn(BRICK + between + STEEL, "Screw it"))).toBe("none");
    editor?.destroy();
    expect(toggleDual(cursorIn(between, "sits"))).toBe("none");
  });
});
