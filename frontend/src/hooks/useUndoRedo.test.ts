import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { UNDO_APPLIED_EVENT, offerToUndo, reselect, useReloadOnUndo } from "./useUndoRedo";
import { toolsApi } from "../api/tools";
import { useToastStore } from "../stores/toastStore";

function fire(detail?: { entity_type: string }) {
  window.dispatchEvent(new CustomEvent(UNDO_APPLIED_EVENT, { detail }));
}

describe("useReloadOnUndo", () => {
  it("reloads for its own entity types and for an untyped event, not for others", () => {
    const reload = vi.fn();
    const { unmount } = renderHook(() => useReloadOnUndo(["culture", "era"], reload));
    fire({ entity_type: "era" });
    fire({ entity_type: "character" });
    fire();
    expect(reload).toHaveBeenCalledTimes(2);
    unmount();
    fire({ entity_type: "era" });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("calls the latest reload and swallows a rejected one", async () => {
    const first = vi.fn();
    const second = vi.fn().mockRejectedValue(new Error("offline"));
    const { rerender } = renderHook(({ fn }) => useReloadOnUndo(["twist"], fn), {
      initialProps: { fn: first },
    });
    rerender({ fn: second });
    fire({ entity_type: "twist" });
    await Promise.resolve();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe("reselect", () => {
  it("swaps in the fresh row, or clears a row undo removed", () => {
    const rows = [{ id: "a", name: "new" }];
    expect(reselect({ id: "a", name: "old" }, rows)).toBe(rows[0]);
    expect(reselect({ id: "b", name: "gone" }, rows)).toBeNull();
    expect(reselect(null, rows)).toBeNull();
  });
});

describe("offerToUndo", () => {
  const state = (label: string | null) => ({
    can_undo: !!label,
    undo_label: label,
    can_redo: false,
    redo_label: null,
  });
  beforeEach(() => useToastStore.setState({ toasts: [] }));

  it("offers a delete's undo, worded as done", () => {
    offerToUndo("s1", state("Delete character Margaret Holt"), vi.fn());
    const [t] = useToastStore.getState().toasts;
    expect(t.text).toBe("Deleted character Margaret Holt");
    expect(t.action?.label).toBe("Undo");
  });

  it("offers nothing for an edit, or while another undo is on offer", () => {
    offerToUndo("s1", state("Rename scene The Lamp"), vi.fn());
    expect(useToastStore.getState().toasts).toHaveLength(0);
    useToastStore.getState().show("Note deleted.", "info", 7000, { label: "Undo", run: vi.fn() });
    offerToUndo("s1", state("Delete culture Islanders"), vi.fn());
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("undoes only while that delete is still the latest change", async () => {
    const undo = vi.fn();
    const spy = vi.spyOn(toolsApi, "undoState");
    offerToUndo("s1", state("Delete culture Islanders"), undo);
    const run = useToastStore.getState().toasts[0].action!.run;

    spy.mockResolvedValueOnce(state("Rename scene The Lamp"));
    await run();
    expect(undo).not.toHaveBeenCalled();

    spy.mockResolvedValueOnce(state("Delete culture Islanders"));
    await run();
    expect(undo).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
