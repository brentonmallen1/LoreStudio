import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { proseStarterKit } from "../starterKit";
import { useStoryStore } from "../../../stores/storyStore";
import type { Location } from "../../../types";
import { ScriptComplete } from "./ScriptComplete";
import { ScriptElementAttribute, ScriptKeys } from "./ScriptElementExtension";

/** SmartType in the editor (doc 25, P3½): Tab takes what is offered, else switches the element. */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function at(content: string): Editor {
  editor = new Editor({
    extensions: [proseStarterKit(), ScriptElementAttribute, ScriptKeys, ScriptComplete],
    content,
  });
  const end = editor.state.doc.content.size - 1;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)));
  return editor;
}

const tab = (ed: Editor) =>
  ed.view.someProp("handleKeyDown", (f) => f(ed.view, new KeyboardEvent("keydown", { key: "Tab" })));

describe("SmartType", () => {
  it("takes a heading's place from the Lorebook on Tab, and shows it faintly first", () => {
    useStoryStore.setState({ locations: [{ id: "l1", name: "Keeper's Cottage" } as Location] });
    const ed = at('<p data-el="heading">INT. KEE</p>');
    expect(ed.view.dom.querySelector(".script-ghost")?.textContent).toBe("PER'S COTTAGE");
    tab(ed);
    expect(ed.getHTML()).toBe('<p data-el="heading">INT. KEEPER\'S COTTAGE</p>');
  });

  it("leaves Tab to switch the element when nothing is offered", () => {
    const ed = at('<p data-el="action">She waits.</p>');
    tab(ed);
    expect(ed.getHTML()).toContain('data-el="cue"');
  });
});
