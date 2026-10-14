import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTipStore } from "../../stores/tipStore";
import { useTypingStore } from "../../stores/typingStore";
import TipLine, { PAUSE_MS, TIP_MS } from "./TipLine";

/** A tip above the status corner, at a pause (doc 26, P4). */
describe("TipLine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    useTypingStore.setState({ used: new Set() });
    useTipStore.setState({ on: true, seen: false, shown: [], pending: null, showing: null });
  });
  afterEach(() => vi.useRealTimers());

  const show = () =>
    render(
      <MemoryRouter>
        <TipLine />
      </MemoryRouter>,
    );

  it("waits for a pause in typing, then names the quicker way", () => {
    show();
    act(() => useTipStore.getState().offer("image"));
    act(() => vi.advanceTimersByTime(PAUSE_MS - 500));
    fireEvent.keyDown(document, { key: "a" });
    act(() => vi.advanceTimersByTime(PAUSE_MS - 500));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("status").textContent).toContain("Quicker than ⋯ › Insert image: type /image.");
  });

  it("says where tips are turned off the first time, and goes after a while", () => {
    show();
    act(() => useTipStore.getState().offer("note"));
    act(() => vi.advanceTimersByTime(PAUSE_MS));
    expect(screen.getByRole("link", { name: "Settings › Writing" }).getAttribute("href")).toBe(
      "/settings#writing",
    );
    act(() => vi.advanceTimersByTime(TIP_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("closes", () => {
    useTipStore.setState({ seen: true, showing: { id: "note", first: false } });
    show();
    expect(screen.queryByRole("link", { name: "Settings › Writing" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close the tip" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
