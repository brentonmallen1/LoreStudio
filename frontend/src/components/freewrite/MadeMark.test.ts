import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { proseStarterKit } from "../editor/starterKit";
import { MadeMark, markMade, refsIn } from "./MadeMark";

let editor: Editor;

function page(html: string) {
  editor = new Editor({
    extensions: [proseStarterKit({ heading: { levels: [3] } }), MadeMark],
    content: html,
  });
  return editor;
}

/** Where `words` start and end in the page's one paragraph, across marks. */
function at(words: string): { from: number; to: number } {
  const i = editor.state.doc.firstChild!.textContent.indexOf(words);
  return { from: 1 + i, to: 1 + i + words.length };
}

afterEach(() => editor?.destroy());

describe("Freewrite's made marks", () => {
  it("keeps what words already became when they become something else too", () => {
    page("<p>The keeper never left the lamp.</p>");
    const whole = at("The keeper never left the lamp.");
    markMade(editor, whole.from, whole.to, "note:q1");
    const part = at("never left");
    markMade(editor, part.from, part.to, "scene:s1");
    expect(refsIn(editor)).toEqual(["note:q1", "scene:s1"]);
    // Saved and opened again, both are still there.
    const again = page(editor.getHTML());
    expect(refsIn(again)).toEqual(["note:q1", "scene:s1"]);
  });

  it("keeps both when the new words overlap the old ones without holding them", () => {
    page("<p>Rain all night. The boat came in at dawn.</p>");
    const first = at("Rain all night. The boat");
    markMade(editor, first.from, first.to, "idea:i1");
    const second = at("The boat came in");
    markMade(editor, second.from, second.to, "character:c1");
    expect(refsIn(editor)).toEqual(["idea:i1", "character:c1"]);
  });

  it("makes the same thing once from the same words", () => {
    page("<p>Gull.</p>");
    const w = at("Gull");
    markMade(editor, w.from, w.to, "character:g");
    markMade(editor, w.from, w.to, "character:g");
    expect(refsIn(editor)).toEqual(["character:g"]);
    expect(editor.getHTML().match(/data-made/g)).toHaveLength(1);
  });
});
