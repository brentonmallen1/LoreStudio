import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, useToastStore } from "./toastStore";

describe("toasts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useRealTimers();
  });

  it("each toast leaves on its own timer", () => {
    toast.success("Snapshot created");
    vi.advanceTimersByTime(2000);
    toast.error("Delete failed");
    vi.advanceTimersByTime(2000);
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(["Delete failed"]);
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("shows a repeated message once", () => {
    toast.error("Delete failed");
    toast.error("Delete failed");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("keeps at most four on screen", () => {
    for (let i = 0; i < 6; i++) toast.info(`m${i}`);
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(["m2", "m3", "m4", "m5"]);
  });
});
