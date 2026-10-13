import { afterEach, describe, expect, it } from "vitest";
import { Editor, getHTMLFromFragment } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import { headingBelowTop, headingsBelowTop, ScriptElementAttribute } from "./ScriptElementExtension";

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

function cursorIn(needle: string, content = TOP + NEXT): Editor {
  editor = new Editor({ extensions: [proseStarterKit(), ScriptElementAttribute], content });
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

  it("takes the heading under a script's opening FADE IN: as the scene's own", () => {
    const fade = '<p data-el="action">FADE IN:</p>';
    expect(headingBelowTop(cursorIn("COTTAGE", fade + TOP + NEXT))).toBeNull();
    expect(headingsBelowTop(editor!.state.doc)).toHaveLength(1);
  });

  it("finds every heading below the scene's own, where several scenes were pasted", () => {
    const ed = cursorIn("Rain", TOP + NEXT + NEXT);
    const below = headingsBelowTop(ed.state.doc);
    expect(below).toHaveLength(2);
    expect(getHTMLFromFragment(ed.state.doc.content.cut(0, below[0]), ed.state.schema)).toBe(TOP);
  });

  it("is nothing on an empty line set to heading, as Enter after a transition leaves one", () => {
    const empty = TOP + '<p data-el="transition">BLACKOUT.</p><p data-el="heading"></p>';
    editor = new Editor({ extensions: [proseStarterKit(), ScriptElementAttribute], content: empty });
    const end = editor.state.doc.content.size - 1;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)));
    expect(headingBelowTop(editor)).toBeNull();
    expect(headingsBelowTop(editor.state.doc)).toEqual([]);
  });
});
