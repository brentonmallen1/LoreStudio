import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../../components/editor/starterKit";
import { ScriptElementAttribute } from "../../components/editor/script/ScriptElementExtension";
import { contextsAt, helpersHere } from "./context";
import type { HelperId } from "./helpers";

/** What you can type where the cursor is (doc 26, P3). */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** An editor with the cursor where `|` is, or the words between two `|` selected. */
function at(html: string, script = false): Editor {
  editor = new Editor({
    extensions: script ? [proseStarterKit(), ScriptElementAttribute] : [proseStarterKit()],
    content: html.replaceAll("|", "§"),
  });
  const marks: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (let i = node.text!.indexOf("§"); i >= 0; i = node.text!.indexOf("§", i + 1)) marks.push(pos + i);
  });
  const tr = editor.state.tr;
  for (const p of [...marks].reverse()) tr.delete(p, p + 1);
  // The second mark moves back by the first one taken out before it.
  const [a, b = a + 1] = marks;
  tr.setSelection(TextSelection.create(tr.doc, a, b - 1 > a ? b - 1 : a));
  editor.view.dispatch(tr);
  return editor;
}

describe("where the cursor is", () => {
  it("knows a closing quote in prose", () => {
    expect(contextsAt(at("<p>“Run,”|</p>").state, "prose")).toContain("after-quote");
    expect(contextsAt(at('<p>"Run,"|</p>').state, "prose")).toContain("after-quote");
    expect(contextsAt(at('<p>"Run|</p>').state, "prose")).not.toContain("after-quote");
  });

  it("knows a selection", () => {
    expect(contextsAt(at("<p>She |ran| home.</p>").state, "prose")).toEqual(["anywhere", "selection"]);
  });

  it("knows a script's line", () => {
    const cue = at('<p data-el="cue">ELEA|</p>', true).state;
    expect(contextsAt(cue, "screenplay")).toEqual(expect.arrayContaining(["in-cue", "line-end"]));
    const speech = at('<p data-el="action">x</p><p data-el="dialogue">|</p>', true).state;
    expect(contextsAt(speech, "screenplay")).toContain("in-speech");
    const start = at('<p data-el="action">x</p><p data-el="action">|</p>', true).state;
    expect(contextsAt(start, "screenplay")).toContain("line-start");
  });
});

describe("the helpers for a spot", () => {
  const none = new Set<HelperId>();

  it("puts the one for this spot first, then the rest", () => {
    const ids = helpersHere("prose", ["anywhere", "after-quote"], none).map((h) => h.id);
    expect(ids[0]).toBe("tag");
    expect(ids).toContain("line");
    expect(ids).not.toContain("attribute");
  });

  it("puts the ones already used last", () => {
    const ids = helpersHere("prose", ["anywhere"], new Set<HelperId>(["line"])).map((h) => h.id);
    expect(ids[ids.length - 1]).toBe("line");
  });

  it("leaves a script's Enter, Tab, element keys, ^ and / to its keys card", () => {
    const ids = helpersHere("screenplay", ["anywhere", "in-cue"], none).map((h) => h.id);
    expect(ids[0]).toBe("script-cue");
    expect(ids).not.toContain("script-tab");
    expect(ids).not.toContain("line");
    expect(ids).not.toContain("tag");
  });
});
