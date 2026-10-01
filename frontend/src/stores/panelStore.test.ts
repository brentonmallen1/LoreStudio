import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "./panelStore";

/** Doc 12 P2: the panel is part of the desk while writing, a reference on every other page. */
describe("panel open per side", () => {
  beforeEach(() => {
    usePanelStore.setState({ side: "writing", openBySide: { writing: true, pages: false }, open: true });
  });

  it("collapses on leaving the prose and comes back on return", () => {
    const { setSide } = usePanelStore.getState();
    setSide("pages");
    expect(usePanelStore.getState().open).toBe(false);
    setSide("writing");
    expect(usePanelStore.getState().open).toBe(true);
  });

  it("remembers each side's own choice", () => {
    const s = usePanelStore.getState();
    s.setSide("pages");
    s.setOpen(true);
    s.setSide("writing");
    usePanelStore.getState().setOpen(false);
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("an explicit open wins on the side you are on", () => {
    usePanelStore.getState().setSide("pages");
    usePanelStore.getState().openTool("characters");
    expect(usePanelStore.getState().open).toBe(true);
    expect(usePanelStore.getState().openBySide.pages).toBe(true);
    expect(usePanelStore.getState().openBySide.writing).toBe(true);
  });

  it("toggle acts on the current side only", () => {
    usePanelStore.getState().toggle();
    expect(usePanelStore.getState().openBySide).toEqual({ writing: false, pages: false });
  });
});
