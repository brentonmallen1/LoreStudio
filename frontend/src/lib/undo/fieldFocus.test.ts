import { describe, expect, it } from "vitest";
import { isUntouchedField } from "./fieldFocus";

function key(target: HTMLElement) {
  const e = new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true });
  Object.defineProperty(e, "target", { value: target });
  return e;
}

describe("⌘Z in a text field", () => {
  it("goes to the story until the author types in the field, and again after they leave it", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(isUntouchedField(key(input))).toBe(true);
    input.value = "typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(isUntouchedField(key(input))).toBe(false);
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(isUntouchedField(key(input))).toBe(true);
    input.remove();
  });

  it("is never the prose or another editor", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    expect(isUntouchedField(key(div))).toBe(false);
  });
});
