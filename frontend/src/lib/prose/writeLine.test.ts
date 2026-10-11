import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../../components/editor/starterKit";
import { ScriptElementAttribute, ScriptKeys } from "../../components/editor/script/ScriptElementExtension";
import { writeSpokenLine, type SpokenLine } from "./writeLine";
import type { StoryFormat } from "../../types";

/**
 * One way to write (doc 25, D6): the same gesture on the same words, in prose and in a
 * script, and each lands formatted for its format.
 */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function make(content: string, script = false) {
  editor = new Editor({
    extensions: [proseStarterKit(), ScriptElementAttribute, ...(script ? [ScriptKeys] : [])],
    content,
  });
  return editor;
}

/** The document position of the first `needle` in the text. */
function at(ed: Editor, needle: string): number {
  let found = -1;
  ed.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return found < 0;
    const i = node.text!.indexOf(needle);
    if (i >= 0) found = pos + i;
    return false;
  });
  if (found < 0) throw new Error(`no ${needle}`);
  return found;
}

function write(ed: Editor, format: StoryFormat, line: Omit<SpokenLine, "speaker" | "quotes">) {
  const tr = ed.state.tr;
  writeSpokenLine(tr, format, { ...line, speaker: "Eleanor", quotes: ["“", "”"] });
  ed.view.dispatch(tr);
  return ed.getHTML();
}

describe("a spoken line, written the same way in both formats", () => {
  const LINE = "<p>She waited. ^</p>";
  it("^ asks for a new line: a tagged quote in prose", () => {
    const ed = make(LINE);
    const from = at(ed, "^");
    expect(write(ed, "prose", { kind: "line", from, to: from + 1 })).toBe(
      "<p>She waited. “”&lt;Eleanor&gt;</p>",
    );
  });

  it("^ asks for a new line: a cue and an empty line of dialogue in a script, ready to type", () => {
    const ed = make(LINE, true);
    const from = at(ed, "^");
    expect(write(ed, "screenplay", { kind: "line", from, to: from + 1 })).toBe(
      '<p>She waited.</p><p data-el="cue">ELEANOR</p><p data-el="dialogue"></p>',
    );
    ed.commands.insertContent("It's still burning.");
    expect(ed.getHTML()).toContain('<p data-el="dialogue">It\'s still burning.</p>');
  });

  const WRAP = "<p>She said <em>hello</em> there and left.</p>";
  it("Attribute on a selection: quoted and tagged in prose", () => {
    const ed = make(WRAP);
    const from = at(ed, "hello");
    expect(write(ed, "prose", { kind: "wrap", from, to: at(ed, " and") })).toBe(
      "<p>She said “<em>hello</em> there”&lt;Eleanor&gt; and left.</p>",
    );
  });

  it("Attribute on a selection: its own speech in a script, italics kept, the rest action", () => {
    const ed = make(WRAP, true);
    const from = at(ed, "hello");
    expect(write(ed, "screenplay", { kind: "wrap", from, to: at(ed, " and") })).toBe(
      '<p>She said</p><p data-el="cue">ELEANOR</p><p data-el="dialogue"><em>hello</em> there</p>' +
        '<p data-el="action">and left.</p>',
    );
  });

  it("Attribute drops the quote marks a script's speech does not need", () => {
    const ed = make("<p>“Run.”</p>", true);
    const from = at(ed, "“");
    expect(write(ed, "screenplay", { kind: "wrap", from, to: from + 6 })).toBe(
      '<p data-el="cue">ELEANOR</p><p data-el="dialogue">Run.</p>',
    );
  });

  const TAG = '<p>He waited. "Go now." &lt;El</p>';
  it("< after a quote: the speaker's tag in prose", () => {
    const ed = make(TAG);
    const from = at(ed, "El");
    expect(write(ed, "prose", { kind: "tag", from, to: from + 2 })).toBe(
      '<p>He waited. "Go now." &lt;Eleanor&gt;</p>',
    );
  });

  it("< after a quote: the quote leaves the action line for a speech in a script", () => {
    const ed = make(TAG, true);
    const from = at(ed, "El");
    expect(write(ed, "screenplay", { kind: "tag", from, to: from + 2 })).toBe(
      '<p>He waited.</p><p data-el="cue">ELEANOR</p><p data-el="dialogue">Go now.</p>',
    );
  });
});

// ── The script's extras (D2) ───────────────────────────────────────────────────────────

function key(ed: Editor, k: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key: k, shiftKey });
  return ed.view.someProp("handleKeyDown", (f) => f(ed.view, event));
}

function type(ed: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = ed.state.selection;
    const insert = () => ed.state.tr.insertText(ch, from, to);
    const handled = ed.view.someProp("handleTextInput", (f) => f(ed.view, from, to, ch, insert));
    if (!handled) ed.view.dispatch(insert());
  }
}

function end(ed: Editor) {
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.atEnd(ed.state.doc)));
}

describe("the script editor's keys", () => {
  it("a name in capitals and Enter becomes a cue, and the next line is its dialogue", () => {
    const ed = make("<p>ELEANOR</p>", true);
    end(ed);
    key(ed, "Enter");
    type(ed, "Still burning.");
    expect(ed.getHTML()).toBe('<p data-el="cue">ELEANOR</p><p data-el="dialogue">Still burning.</p>');
  });

  it("loud action stays action", () => {
    const ed = make("<p>BOOM!</p>", true);
    end(ed);
    key(ed, "Enter");
    expect(ed.getHTML()).toBe('<p>BOOM!</p><p data-el="action"></p>');
  });

  it("INT. starts a scene heading, typed in capitals", () => {
    const ed = make("<p></p>", true);
    type(ed, "int. lighthouse - night");
    expect(ed.getHTML()).toBe('<p data-el="heading">INT. LIGHTHOUSE - NIGHT</p>');
  });

  it("( in an empty line of speech is a parenthetical, and Enter goes back to dialogue", () => {
    const ed = make('<p data-el="cue">ELEANOR</p><p data-el="dialogue"></p>', true);
    end(ed);
    type(ed, "(");
    type(ed, "quietly");
    expect(ed.getHTML()).toContain('<p data-el="paren">(quietly)</p>');
    // Enter inside the brackets, as anyone would press it, finishes the parenthetical.
    key(ed, "Enter");
    type(ed, "Don't.");
    expect(ed.getHTML()).toBe(
      '<p data-el="cue">ELEANOR</p><p data-el="paren">(quietly)</p><p data-el="dialogue">Don\'t.</p>',
    );
  });

  it("typing the closing bracket steps over the one already there", () => {
    const ed = make('<p data-el="dialogue"></p>', true);
    type(ed, "(beat)");
    expect(ed.getHTML()).toBe('<p data-el="paren">(beat)</p>');
  });

  it("Tab turns action into a cue in capitals, Shift-Tab back", () => {
    const ed = make("<p>eleanor</p>", true);
    end(ed);
    key(ed, "Tab");
    expect(ed.getHTML()).toBe('<p data-el="cue">ELEANOR</p>');
    key(ed, "Tab", true);
    expect(ed.getHTML()).toBe('<p data-el="action">ELEANOR</p>');
  });

  it("Enter on an empty cue clears it to action", () => {
    const ed = make('<p data-el="cue"></p>', true);
    key(ed, "Enter");
    expect(ed.getHTML()).toBe('<p data-el="action"></p>');
  });

  it("prose has none of it: Enter and Tab are the editor's own", () => {
    const ed = make("<p>ELEANOR</p>");
    end(ed);
    expect(key(ed, "Tab")).toBeFalsy();
  });
});
