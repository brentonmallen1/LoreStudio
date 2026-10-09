import { describe, expect, it } from "vitest";
import { STRIP_PX, fitTabs, stripBudget, tabMinWidth } from "./overflow";

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

describe("the strip at the panel's default width", () => {
  // The panel docks at 360px: 1px border and 0.4rem (6px) padding each side leave 347px.
  const CONTENT = 360 - 1 - 2 * 6;
  const strip = (n: number) => [
    { id: "scene", kind: "scene" },
    ...Array.from({ length: n }, (_, i) => ({ id: `entity:${i}`, kind: "entity" })),
  ];
  const fit = (all: { id: string; kind: string }[], active: string, assistant = false, scale = 1) => {
    const px = (v: number) => Math.round(v * scale);
    const b = stripBudget(all, active, CONTENT, { assistant, px });
    return fitTabs(all, b.widths, b.room, active, b.overflowReserve, b.defaultWidth);
  };

  it("shows This scene and three characters, the newest one active", () => {
    const { visible, hidden } = fit(strip(3), "entity:2");
    expect(visible.map((t) => t.id)).toEqual(["scene", "entity:0", "entity:1", "entity:2"]);
    expect(hidden).toEqual([]);
  });

  it("shows them with This scene active too", () => {
    expect(fit(strip(3), "scene").hidden).toEqual([]);
  });

  it("folds the fifth and later into ☰, never the active one", () => {
    const { visible, hidden } = fit(strip(6), "entity:5");
    expect(visible.map((t) => t.id)).toContain("entity:5");
    expect(visible.map((t) => t.id)).toContain("scene");
    expect(visible.length).toBeGreaterThanOrEqual(3);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("leaves room for the Assistant tab in the pop-out window", () => {
    const b = stripBudget(strip(0), "scene", CONTENT, { assistant: true });
    expect(CONTENT - b.room).toBeGreaterThanOrEqual(STRIP_PX.assistant + STRIP_PX.open);
  });

  it("gives the active tab room for its ×", () => {
    expect(tabMinWidth({ kind: "entity" }, true)).toBe(STRIP_PX.tabMin + STRIP_PX.close);
    expect(tabMinWidth({ kind: "scene" }, true)).toBe(STRIP_PX.tabMin);
  });
});
