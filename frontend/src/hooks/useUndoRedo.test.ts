import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { UNDO_APPLIED_EVENT, reselect, useReloadOnUndo } from "./useUndoRedo";

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
