import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { proseStarterKit } from "../components/editor/starterKit";
import { api } from "../api/client";
import { ApiError } from "../api/request";
import { toolsApi, type UndoResult } from "../api/tools";
import { SCENES_REWRITTEN_EVENT } from "../lib/sceneEvents";
import type { StructureNode } from "../types";
import { useStoryStore } from "./storyStore";
import { UnifiedUndoExtension } from "../components/editor/UnifiedUndoExtension";
import { setLiveScene } from "../lib/undo/sceneHistory";
import { EMPTY_TIMELINE } from "../lib/undo/timeline";
import {
  applyResult,
  forgetChange,
  refreshServer,
  runUndo,
  serverActed,
  setUndoStory,
  undoView,
  useUndoStore,
} from "./undoStore";

const result = (label: string): UndoResult => ({
  label,
  entity_type: "note",
  entity_ids: ["n1"],
  batch_id: "u1",
  scene_ids: [],
});

let editor: Editor;
const flush = vi.fn(async () => {});

function type(text: string) {
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  editor.commands.insertContent(text);
}

beforeEach(() => {
  vi.spyOn(toolsApi, "undoState").mockResolvedValue({
    can_undo: true,
    undo_label: "Add note",
    can_redo: false,
    redo_label: null,
  });
  vi.spyOn(toolsApi, "undo").mockResolvedValue(result("Add note"));
  vi.spyOn(toolsApi, "redo").mockResolvedValue(result("Add note"));
  useUndoStore.setState({ storyId: null, timeline: EMPTY_TIMELINE, busy: false, error: null });
  setUndoStory("s1");
  editor = new Editor({ extensions: [proseStarterKit(), UnifiedUndoExtension], content: "<p>Start</p>" });
  setLiveScene({ editor, nodeId: "scene", title: "The Lamp", flush });
});

afterEach(() => {
  setLiveScene(null);
  editor.destroy();
  vi.restoreAllMocks();
  flush.mockClear();
});

describe("⌘Z across the editor and the server", () => {
  it("undoes and redoes in the order things happened", async () => {
    type(" one");
    serverActed("s1", "b1");
    type(" two");
    expect(useUndoStore.getState().timeline.done.map((s) => s.kind)).toEqual(["editor", "server", "editor"]);
    expect(undoView().undoLabel).toBe("typing in “The Lamp”");

    await runUndo("undo"); // the second typing
    expect(editor.getText()).toBe("Start one");
    expect(toolsApi.undo).not.toHaveBeenCalled();

    await runUndo("undo"); // the server's change, after saving the scene
    expect(flush).toHaveBeenCalled();
    expect(toolsApi.undo).toHaveBeenCalledTimes(1);

    await runUndo("undo"); // the first typing
    expect(editor.getText()).toBe("Start");

    await runUndo("redo");
    expect(editor.getText()).toBe("Start one");
    await runUndo("redo");
    expect(toolsApi.redo).toHaveBeenCalledTimes(1);
    await runUndo("redo");
    expect(editor.getText()).toBe("Start one two");
  });

  it("the editor's own ⌘Z goes through the timeline", async () => {
    serverActed("s1", "b1");
    // Mod-z in the prose: the server's change is newer than any typing.
    const mac = /Mac|iP(hone|[oa]d)/.test(navigator.platform);
    const event = new KeyboardEvent("keydown", { key: "z", metaKey: mac, ctrlKey: !mac });
    editor.view.someProp("handleKeyDown", (f) => f(editor.view, event));
    await vi.waitFor(() => expect(toolsApi.undo).toHaveBeenCalledTimes(1));
  });

  it("with nothing on the timeline, falls back to the server's history from before", async () => {
    await vi.waitFor(() => expect(useUndoStore.getState().server.can_undo).toBe(true));
    await runUndo("undo");
    expect(toolsApi.undo).toHaveBeenCalledTimes(1);
  });

  it("a change in another story is not a step here", () => {
    serverActed("other", "b9");
    expect(useUndoStore.getState().timeline.done).toEqual([]);
  });
});

describe("when it cannot", () => {
  it("says why when the server refuses, and keeps the step to try again", async () => {
    vi.mocked(toolsApi.undo).mockRejectedValueOnce(new ApiError(409, "The title of “A” was edited again"));
    serverActed("s1", "b1");
    await runUndo("undo");
    expect(useUndoStore.getState().error).toContain("edited again");
    expect(useUndoStore.getState().timeline.done).toHaveLength(1);
    vi.mocked(toolsApi.undo).mockRejectedValueOnce(new Error("offline"));
    await runUndo("undo");
    expect(useUndoStore.getState().error).toBe("Could not undo");
    vi.mocked(toolsApi.undo).mockRejectedValueOnce(new ApiError(404, "Nothing to undo"));
    await runUndo("undo");
    expect(useUndoStore.getState().error).toBeNull();
  });

  it("does nothing while busy, without a story, or with nothing anywhere to undo", async () => {
    useUndoStore.setState({ busy: true });
    serverActed("s1", "b1");
    await runUndo("undo");
    expect(toolsApi.undo).not.toHaveBeenCalled();
    useUndoStore.setState({ busy: false, storyId: null });
    await runUndo("undo");
    expect(toolsApi.undo).not.toHaveBeenCalled();
    useUndoStore.setState({
      storyId: "s1",
      timeline: EMPTY_TIMELINE,
      server: { can_undo: false, undo_label: null, can_redo: false, redo_label: null },
    });
    await runUndo("undo");
    await runUndo("redo");
    expect(toolsApi.undo).not.toHaveBeenCalled();
    expect(toolsApi.redo).not.toHaveBeenCalled();
  });

  it("redo reaches the server's own history only until something new happens", async () => {
    useUndoStore.setState({
      server: { can_undo: false, undo_label: null, can_redo: true, redo_label: "Add note" },
    });
    expect(undoView()).toMatchObject({ canRedo: true, redoLabel: "Add note" });
    type(" new");
    expect(undoView().canRedo).toBe(false);
    await runUndo("redo");
    expect(toolsApi.redo).not.toHaveBeenCalled();
  });

  it("a toast's Undo takes back the server's change even with typing since, and ⇧⌘Z redoes it", async () => {
    serverActed("s1", "b1");
    type(" since");
    await runUndo("undo", { serverOnly: true });
    expect(toolsApi.undo).toHaveBeenCalledTimes(1);
    expect(editor.getText()).toBe("Start since");
    const { done, undone } = useUndoStore.getState().timeline;
    expect(done.map((s) => s.kind)).toEqual(["editor"]);
    expect(undone).toEqual([{ kind: "server", batch: "b1" }]);
  });

  it("a change undone from the Chronicle leaves the timeline", () => {
    serverActed("s1", "b1");
    forgetChange("b1");
    expect(useUndoStore.getState().timeline.done).toEqual([]);
  });

  it("a story it cannot read has nothing to undo", async () => {
    vi.mocked(toolsApi.undoState).mockRejectedValueOnce(new Error("gone"));
    await refreshServer();
    expect(useUndoStore.getState().server.can_undo).toBe(false);
  });
});

describe("after an undo", () => {
  const node = { id: "scene", title: "The Lamp", content: "<p>x</p>" } as StructureNode;

  it("reloads what it touched and hands rewritten prose to the open scene", async () => {
    vi.spyOn(api, "getStructure").mockResolvedValue([]);
    vi.spyOn(api, "getNode").mockResolvedValue({ ...node, title: "Back" });
    vi.spyOn(api, "listCharacters").mockResolvedValue([]);
    vi.spyOn(api, "getStory").mockResolvedValue({ id: "s1" } as never);
    useStoryStore.setState({ activeNode: node });
    const rewritten = vi.fn();
    window.addEventListener(SCENES_REWRITTEN_EVENT, rewritten);

    // A rename of the open scene: its node is fetched again.
    await applyResult("s1", { ...result("Rename"), entity_type: "structure_node", scene_ids: [] });
    expect(useStoryStore.getState().activeNode?.title).toBe("Back");
    // Its prose put back: the editor's own reload takes it, not the store.
    vi.mocked(api.getNode).mockClear();
    await applyResult("s1", { ...result("Replace"), entity_type: "structure_node", scene_ids: ["scene"] });
    expect(api.getNode).not.toHaveBeenCalled();
    expect(rewritten).toHaveBeenCalledTimes(1);
    // A scene the undo removed.
    vi.mocked(api.getNode).mockRejectedValueOnce(new ApiError(404, "gone"));
    await applyResult("s1", { ...result("Add scene"), entity_type: "structure_node", scene_ids: [] });
    expect(useStoryStore.getState().activeNode).toBeNull();

    await applyResult("s1", { ...result("Rename"), entity_type: "character" });
    expect(api.listCharacters).toHaveBeenCalledWith("s1");
    await applyResult("s1", { ...result("Logline"), entity_type: "story" });
    expect(api.getStory).toHaveBeenCalledWith("s1");
    window.removeEventListener(SCENES_REWRITTEN_EVENT, rewritten);
  });
});
