import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { useEditorBridge } from "../../../stores/editorBridge";
import { useStoryStore } from "../../../stores/storyStore";
import { editingTake, useTakesStore } from "../../../stores/takesStore";
import type { StructureNode } from "../../../types";
import type { SceneTake } from "../../../types/takes";
import { proseStarterKit } from "../starterKit";
import { useSceneAutosave } from "../useSceneAutosave";
import TakeSwitcher from "./TakeSwitcher";
import TakesCompare from "./TakesCompare";
import type { TakesBridge } from "./useSceneTakes";

const SCENE = {
  id: "s1",
  story_id: "st",
  title: "Knock at the Door",
  content: "<p>The knock came.</p>",
  word_count: 3,
  updated_at: "2026-10-16T10:00:00",
  take_count: 2,
} as StructureNode;

function take(n: number, over: Partial<SceneTake> = {}): SceneTake {
  return {
    id: `t${n}`,
    node_id: "s1",
    number: n,
    label: "",
    content: "<p>The knock came.</p>",
    word_count: 3,
    counts: false,
    is_open: false,
    created_at: "2026-10-12T10:00:00",
    updated_at: "2026-10-14T10:00:00",
    ...over,
  };
}

const TAKE_1 = take(1, { label: "first draft", counts: true });
const TAKE_2 = take(2, { label: "Calder speaks first", content: "<p>“You’re the keeper,” she said.</p>" });

function bridge(): TakesBridge {
  return {
    tryAnother: vi.fn(),
    switchTo: vi.fn(),
    use: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    compare: vi.fn(),
    refresh: vi.fn(async () => {}),
  };
}

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

beforeEach(() => {
  useStoryStore.setState({ activeNode: SCENE, activeStory: null });
  useTakesStore.getState().reset("s1");
});

describe("the take switcher", () => {
  it("stays out of the header while the scene has one take", () => {
    useEditorBridge.setState({ takes: bridge() });
    useTakesStore.getState().setTakes("s1", []);
    const { container } = render(<TakeSwitcher />);
    expect(container.innerHTML).toBe("");
  });

  it("shows each take, the open one pressed and the one that counts ticked", () => {
    const b = bridge();
    useEditorBridge.setState({ takes: b });
    useTakesStore.getState().setTakes("s1", [{ ...TAKE_1, is_open: true }, TAKE_2]);
    render(<TakeSwitcher />);
    const tabs = within(screen.getByRole("tablist", { name: "Takes of this scene" })).getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Take 1 · first draft, the one that counts",
      "Take 2 · Calder speaks first",
    ]);
    expect(tabs[0].textContent).toBe("Take 1 · first draft✓");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    // The open take counts: nothing to choose.
    expect(screen.queryByRole("button", { name: "Use this take" })).toBeNull();
    fireEvent.click(tabs[1]);
    expect(b.switchTo).toHaveBeenCalledWith("t2");
    fireEvent.click(screen.getByRole("button", { name: "Try another version" }));
    expect(b.tryAnother).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(b.compare).toHaveBeenCalledWith(true);
  });

  it("offers Use this take while a take that does not count is open", () => {
    const b = bridge();
    useEditorBridge.setState({ takes: b });
    useTakesStore.getState().setTakes("s1", [TAKE_1, { ...TAKE_2, is_open: true }]);
    render(<TakeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Use this take" }));
    expect(b.use).toHaveBeenCalledWith("t2");
  });
});

describe("compare", () => {
  it("marks what only each take has, with its legend, and the one that counts", () => {
    const onUse = vi.fn();
    render(<TakesCompare takes={[TAKE_1, { ...TAKE_2, is_open: true }]} onUse={onUse} />);
    expect(screen.getByText("The knock came.").tagName).toBe("DEL");
    expect(screen.getByText("“You’re the keeper,” she said.").tagName).toBe("INS");
    expect(screen.getByText("only in take 1")).toBeTruthy();
    expect(screen.getByText("only in take 2")).toBeTruthy();
    expect(screen.getByText("✓ The one that counts")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 place differs");
    fireEvent.click(screen.getByRole("button", { name: "Use this take" }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: "t2" }));
  });
});

describe("autosave with takes", () => {
  function sent() {
    const calls: { to: string; body: unknown }[] = [];
    server.use(
      http.put("/api/takes/:id/content", async ({ request, params }) => {
        const body = (await request.json()) as { content: string; word_count: number };
        calls.push({ to: `take:${params.id}`, body });
        return HttpResponse.json({ ...TAKE_2, ...body, updated_at: "2026-10-16T11:00:00" });
      }),
      http.patch("/api/structure/:id", async ({ request, params }) => {
        calls.push({ to: `scene:${params.id}`, body: await request.json() });
        return HttpResponse.json({ ...SCENE, updated_at: "2026-10-16T11:00:00" });
      }),
    );
    return calls;
  }

  function typeIn(html: string) {
    editor = new Editor({ extensions: [proseStarterKit()], content: html });
    const { result } = renderHook(() => useSceneAutosave(editor));
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " Again.");
    act(() => result.current.handleUpdate(editor!));
    return result;
  }

  it("saves typing to the open take when it does not count, and leaves the scene alone", async () => {
    const calls = sent();
    useTakesStore.getState().setTakes("s1", [TAKE_1, { ...TAKE_2, is_open: true }]);
    expect(editingTake("s1")?.id).toBe("t2");
    const result = typeIn(TAKE_2.content);
    await act(() => result.current.flush());
    expect(calls.map((c) => c.to)).toEqual(["take:t2"]);
    expect((calls[0].body as { content: string }).content).toContain("Again.");
    expect(useTakesStore.getState().takes[1].content).toContain("Again.");
    expect(useStoryStore.getState().activeNode?.content).toBe(SCENE.content);
  });

  it("saves typing as the scene when the open take is the one that counts", async () => {
    const calls = sent();
    useTakesStore.getState().setTakes("s1", [{ ...TAKE_1, is_open: true }, TAKE_2]);
    expect(editingTake("s1")).toBeNull();
    const result = typeIn(SCENE.content);
    await act(() => result.current.flush());
    expect(calls.map((c) => c.to)).toEqual(["scene:s1"]);
  });

  it("saves what was typed in a take there, even after a switch to another", async () => {
    const calls = sent();
    useTakesStore.getState().setTakes("s1", [TAKE_1, { ...TAKE_2, is_open: true }]);
    const result = typeIn(TAKE_2.content);
    // The switch lands before the save does: the words still go to take 2.
    useTakesStore.getState().setTakes("s1", [{ ...TAKE_1, is_open: true }, TAKE_2]);
    await act(() => result.current.flush());
    expect(calls.map((c) => c.to)).toEqual(["take:t2"]);
  });
});
