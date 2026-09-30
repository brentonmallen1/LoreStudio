import { describe, expect, it } from "vitest";
import { fitTabs } from "./overflow";

const tab = (id: string) => ({ id });
const tabs = ["scene", "a", "b", "c", "d"].map(tab);
const widths = { scene: 80, a: 90, b: 90, c: 90, d: 90 };

describe("fitTabs", () => {
  it("shows everything when it fits", () => {
    expect(fitTabs(tabs, widths, 500, "a")).toEqual({ visible: tabs, hidden: [] });
  });

  it("folds the tail into the menu and reserves room for the ☰ button", () => {
    const { visible, hidden } = fitTabs(tabs, widths, 280, "a", 40);
    expect(visible.map((t) => t.id)).toEqual(["scene", "a"]);
    expect(hidden.map((t) => t.id)).toEqual(["b", "c", "d"]);
  });

  it("always keeps the active tab visible, in document order", () => {
    const { visible, hidden } = fitTabs(tabs, widths, 300, "d", 40);
    expect(visible.map((t) => t.id)).toEqual(["scene", "a", "d"]);
    expect(hidden.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("assumes a default width for a tab not measured yet", () => {
    const { visible } = fitTabs(tabs, {}, 200, "scene", 40, 96);
    expect(visible.map((t) => t.id)).toEqual(["scene"]);
  });
});
