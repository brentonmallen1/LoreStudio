import { afterEach, describe, expect, it } from "vitest";
import { Editor, getHTMLFromFragment } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import {
  headingBelowTop,
  headingsBelowTop,
  ScriptElementAttribute,
  ScriptKeys,
  setHeadingEnter,
} from "./ScriptElementExtension";

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

/** Enter at the end of a heading typed further down starts the new scene (Brenton, 2026-10-12). */
describe("Enter on a heading below the scene's own", () => {
  const enter = (ed: Editor) =>
    ed.view.someProp("handleKeyDown", (f) => f(ed.view, new KeyboardEvent("keydown", { key: "Enter" })));

  function atEnd(content: string): Editor {
    editor = new Editor({ extensions: [proseStarterKit(), ScriptElementAttribute, ScriptKeys], content });
    const end = editor.state.doc.content.size - 1;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)));
    return editor;
  }

  it("hands the heading to the split, and leaves its own heading and an empty one to Enter", () => {
    const asked: number[] = [];
    setHeadingEnter((pos) => asked.push(pos));
    try {
      const ed = atEnd(TOP + '<p data-el="heading">EXT. SEA - DAY</p>');
      expect(enter(ed)).toBe(true);
      expect(asked).toEqual([headingsBelowTop(ed.state.doc)[0]]);
      ed.destroy();

      atEnd(TOP + '<p data-el="heading"></p>');
      enter(editor!);
      editor!.destroy();
      atEnd('<p data-el="heading">INT. COTTAGE - NIGHT</p>');
      enter(editor!);
      expect(asked).toHaveLength(1);
    } finally {
      setHeadingEnter(null);
    }
  });

  it("starts the scene when the words were typed as action and read as a heading", () => {
    const asked: number[] = [];
    setHeadingEnter((pos) => asked.push(pos));
    try {
      const ed = atEnd(TOP + '<p data-el="action">EXT. SEA - DAY</p>');
      enter(ed);
      expect(asked).toHaveLength(1);
      expect(ed.state.doc.nodeAt(asked[0])?.attrs.el).toBe("heading");
    } finally {
      setHeadingEnter(null);
    }
  });
});
