import { renderHook } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proseStarterKit } from "./starterKit";
import { useTipWatch } from "./useTipWatch";
import { loadScene } from "../../lib/undo/sceneHistory";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { useTipStore } from "../../stores/tipStore";
import { useTypingStore } from "../../stores/typingStore";
import type { Character } from "../../types";

/** The long way round, noticed while typing (doc 26, P4). */
let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

beforeEach(() => {
  sessionStorage.clear();
  useTypingStore.setState({ used: new Set() });
  useTipStore.setState({ on: true, seen: true, shown: [], pending: null, showing: null });
});

function watch(content = "<p></p>") {
  editor = new Editor({ extensions: [proseStarterKit()], content });
  renderHook(() => useTipWatch(editor, "prose"));
  return editor;
}

/** Types `text` into a new paragraph at the end, a character at a time. */
function typeLine(ed: Editor, text: string) {
  ed.commands.focus("end");
  ed.commands.splitBlock();
  for (const ch of text) ed.commands.insertContent(ch);
}

describe("useTipWatch", () => {
  it("offers ^ at the third speaker written by hand", () => {
    const ed = watch();
    typeLine(ed, "“Run,” Eleanor said.");
    typeLine(ed, "“Where?” asked Tom.");
    expect(useTipStore.getState().pending).toBeNull();
    typeLine(ed, "“Down,” she said.");
    expect(useTipStore.getState().pending).toBeNull();
    typeLine(ed, "“There,” Eleanor said.");
    expect(useTipStore.getState().pending).toBe("line");
  });

  it("does not count a scene loading", () => {
    const ed = watch();
    loadScene(ed, "<p>“Run,” Eleanor said.</p><p>“Run,” Eleanor said.</p><p>“Run,” Eleanor said.</p>");
    expect(useTipStore.getState().pending).toBeNull();
  });

  it("offers @ for names typed out with the Lorebook beside the scene", () => {
    useStoryStore.setState({ characters: [{ id: "c1", name: "Eleanor" } as Character] });
    const ed = watch();
    usePanelStore.setState({ open: false, showing: "tool:characters" });
    typeLine(ed, "Eleanor ran. Eleanor ");
    expect(useTipStore.getState().pending).toBeNull();
    usePanelStore.setState({ open: true });
    typeLine(ed, "Eleanor ran. Eleanor ");
    expect(useTipStore.getState().pending).toBe("mention");
  });
});
