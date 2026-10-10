import { afterEach, describe, expect, it } from "vitest";
import { Editor, getHTMLFromFragment } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import { headingBelowTop, ScriptElementAttribute } from "./ScriptElementExtension";

/**
 * A script scene is one heading (doc 25, D3): a heading below the first line is where the
 * split bar offers to start another scene, and the cut falls on that block.
 */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const TOP = '<p data-el="heading">INT. COTTAGE - NIGHT</p><p data-el="action">Rain.</p>';
const NEXT = '<p data-el="heading">EXT. LIGHTHOUSE - CONTINUOUS</p><p data-el="action">She runs.</p>';

function cursorIn(needle: string): Editor {
  editor = new Editor({ extensions: [proseStarterKit(), ScriptElementAttribute], content: TOP + NEXT });
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(needle)) at = pos + 1;
    return at < 0;
  });
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)));
  return editor;
}

describe("headingBelowTop", () => {
  it("finds a heading below the first line, and the cut there keeps every block whole", () => {
    const ed = cursorIn("LIGHTHOUSE");
    const pos = headingBelowTop(ed);
    expect(pos).not.toBeNull();
    const { doc, schema } = ed.state;
    expect(getHTMLFromFragment(doc.content.cut(0, pos!), schema)).toBe(TOP);
    expect(getHTMLFromFragment(doc.content.cut(pos!), schema)).toBe(NEXT);
  });

  it("is nothing on the scene's own heading or on another line", () => {
    expect(headingBelowTop(cursorIn("COTTAGE"))).toBeNull();
    editor?.destroy();
    expect(headingBelowTop(cursorIn("runs"))).toBeNull();
  });
});
