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
  // The panel docks at 360px: 0.5rem (8px) padding each side leaves 344px.
  const CONTENT = 360 - 2 * 8;
  // The strip holds only what the author opened (doc 24 D11): no This scene, no tools.
  const strip = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `entity:${i}`, kind: "entity" }));
  const fit = (all: { id: string; kind: string }[], active: string, fullPage = false, scale = 1) => {
    const px = (v: number) => Math.round(v * scale);
    const b = stripBudget(all, active, CONTENT, { fullPage, px });
    return fitTabs(all, b.widths, b.room, active, b.overflowReserve, b.defaultWidth);
  };

  it("shows three characters, the newest one showing", () => {
    const { visible, hidden } = fit(strip(3), "entity:2");
    expect(visible.map((t) => t.id)).toEqual(["entity:0", "entity:1", "entity:2"]);
    expect(hidden).toEqual([]);
  });

  it("shows all three while a tool from the rail is showing instead", () => {
    expect(fit(strip(3), "tool:dialogue").hidden).toEqual([]);
  });

  it("shows three at the Large interface size too", () => {
    expect(fit(strip(3), "entity:0", false, 1.1).hidden).toEqual([]);
  });

  it("folds the later ones into ☰, never the one showing", () => {
    const { visible, hidden } = fit(strip(6), "entity:5");
    expect(visible.map((t) => t.id)).toContain("entity:5");
    expect(visible.length).toBeGreaterThanOrEqual(3);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("leaves room for Full page while a page is showing", () => {
    const b = stripBudget(strip(0), "page:storyboard", CONTENT, { fullPage: true });
    expect(CONTENT - b.room).toBeGreaterThanOrEqual(STRIP_PX.fullPage + STRIP_PX.open);
  });

  it("gives the tab showing room for its ×", () => {
    expect(tabMinWidth(true)).toBe(STRIP_PX.tabMin + STRIP_PX.close);
    expect(tabMinWidth(false)).toBe(STRIP_PX.tabMin);
  });
});
