import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { proseStarterKit } from "../../components/editor/starterKit";
import { undoDepth } from "@tiptap/pm/history";
import { liveScene, loadScene, patchScene, setLiveScene } from "./sceneHistory";

let editor: Editor | null = null;

function make(content: string) {
  editor = new Editor({ extensions: [proseStarterKit()], content });
  return editor;
}

function type(ed: Editor, text: string) {
  ed.commands.setTextSelection(ed.state.doc.content.size - 1);
  ed.commands.insertContent(text);
}

afterEach(() => {
  setLiveScene(null);
  editor?.destroy();
  editor = null;
});

describe("the open scene's history", () => {
  it("opening another scene starts a fresh history: ⌘Z never brings back the last scene", () => {
    const ed = make("<p>Scene one</p>");
    type(ed, " typed");
    expect(undoDepth(ed.state)).toBe(1);
    loadScene(ed, "<p>Scene two</p>");
    expect(undoDepth(ed.state)).toBe(0);
    ed.commands.undo();
    expect(ed.getHTML()).toBe("<p>Scene two</p>");
  });

  it("a rewrite from the server is laid in outside history; the typing before it still undoes", () => {
    const ed = make("<p>Elenor waited.</p><p>Night fell</p>");
    type(ed, ". Rain");
    patchScene(ed, "<p>Eleanor waited.</p><p>Night fell. Rain</p>");
    expect(ed.getHTML()).toBe("<p>Eleanor waited.</p><p>Night fell. Rain</p>");
    expect(undoDepth(ed.state)).toBe(1);
    ed.commands.undo();
    // The typing came out; the server's fix stayed (its own undo is the change log's).
    expect(ed.getHTML()).toBe("<p>Eleanor waited.</p><p>Night fell</p>");
  });

  it("the same text again changes nothing", () => {
    const ed = make("<p>Same</p>");
    const before = ed.state;
    patchScene(ed, "<p>Same</p>");
    expect(ed.state).toBe(before);
  });

  it("an editor already torn down is left alone, not crashed into (the panel's This scene tab)", () => {
    // A Suspense boundary hiding the page destroys the editor, then React reconnects the
    // loading effect with the old instance; its view is gone (doc 24 P0 regression).
    const ed = make("<p>Scene one</p>");
    ed.destroy();
    expect(() => loadScene(ed, "<p>Scene two</p>")).not.toThrow();
    expect(() => patchScene(ed, "<p>Scene two</p>")).not.toThrow();
  });

  it("a new history is a new session, so steps from the old one are dead", () => {
    const ed = make("<p>A</p>");
    setLiveScene({ editor: ed, nodeId: "a", title: "A", flush: async () => {} });
    const first = liveScene()!.session;
    setLiveScene({ editor: ed, nodeId: "a", title: "A renamed", flush: async () => {} });
    expect(liveScene()!.session).toBe(first);
    loadScene(ed, "<p>B</p>");
    expect(liveScene()!.session).not.toBe(first);
  });
});
