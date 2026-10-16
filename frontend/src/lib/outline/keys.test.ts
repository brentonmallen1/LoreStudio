import { describe, expect, it } from "vitest";
import { outlineKey, type KeyPress } from "./keys";

const press = (key: string, over: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shift: false,
  mod: false,
  at: "title",
  ...over,
});

describe("the Outline's keys", () => {
  it("while typing a line", () => {
    expect(outlineKey(press("Enter"))).toBe("add-next");
    expect(outlineKey(press("Tab"))).toBe("indent");
    expect(outlineKey(press("Tab", { shift: true }))).toBe("outdent");
    expect(outlineKey(press("ArrowUp"))).toBe("up");
    expect(outlineKey(press("ArrowDown", { at: "synopsis" }))).toBe("down");
    expect(outlineKey(press("Escape"))).toBe("to-row");
  });

  it("moves between a title and what happens only at their ends", () => {
    expect(outlineKey(press("ArrowRight", { caretEnd: true }))).toBe("to-synopsis");
    expect(outlineKey(press("ArrowRight", { caretEnd: false }))).toBeNull();
    expect(outlineKey(press("ArrowLeft", { at: "synopsis", caretStart: true }))).toBe("to-title");
    expect(outlineKey(press("ArrowLeft", { at: "synopsis", caretStart: false }))).toBeNull();
  });

  it("takes away an empty line with Backspace, and only an empty one", () => {
    expect(outlineKey(press("Backspace", { empty: true }))).toBe("remove-empty");
    expect(outlineKey(press("Backspace", { empty: false }))).toBeNull();
  });

  it("on a row: edit, move, fold; Tab stays the browser's, to reach the row's buttons", () => {
    expect(outlineKey(press("Enter", { at: "row" }))).toBe("edit");
    expect(outlineKey(press("F2", { at: "row" }))).toBe("edit");
    expect(outlineKey(press("ArrowLeft", { at: "row" }))).toBe("fold");
    expect(outlineKey(press("ArrowRight", { at: "row" }))).toBe("unfold");
    expect(outlineKey(press("Tab", { at: "row" }))).toBeNull();
  });

  it("on a row, Shift+↑ ↓ choose scenes to wrap and Esc lets them go; in a line they stay the text's", () => {
    expect(outlineKey(press("ArrowDown", { at: "row", shift: true }))).toBe("choose-down");
    expect(outlineKey(press("ArrowUp", { at: "row", shift: true }))).toBe("choose-up");
    expect(outlineKey(press("Escape", { at: "row" }))).toBe("let-go");
    expect(outlineKey(press("ArrowDown", { at: "title", shift: true }))).toBe("down");
  });

  it("leaves the app's shortcuts and an input method's keys alone", () => {
    expect(outlineKey(press("Enter", { mod: true }))).toBeNull();
    expect(outlineKey(press("Enter", { composing: true }))).toBeNull();
    expect(outlineKey(press("Enter", { shift: true }))).toBeNull();
  });
});
