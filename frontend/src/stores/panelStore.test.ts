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

/**
 * Off the prose the scene tab is not something you opened, so closing what you did open
 * shuts the panel. It used to fall back to the scene tab and stay open on every page.
 */
describe("closing back to the scene", () => {
  beforeEach(() => {
    usePanelStore.setState({
      side: "pages",
      openBySide: { writing: true, pages: false },
      open: false,
      tabs: [{ id: "scene", kind: "scene" }],
      activeTabId: "scene",
    });
  });

  it("collapses the panel on a page when the last tab you opened closes", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().close("entity:character:c1");
    const s = usePanelStore.getState();
    expect(s.open).toBe(false);
    expect(s.openBySide.pages).toBe(false);
    expect(s.activeTabId).toBe("scene");
  });

  it("stays open on a page while another tab you opened is left", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().openTool("places");
    usePanelStore.getState().close("tool:places");
    expect(usePanelStore.getState().open).toBe(true);
    expect(usePanelStore.getState().activeTabId).toBe("entity:character:c1");
  });

  it("collapses on a page when the Assistant closes or is toggled away", () => {
    usePanelStore.getState().openAssistant();
    usePanelStore.getState().close("assistant");
    expect(usePanelStore.getState().open).toBe(false);
    usePanelStore.getState().openAssistant();
    usePanelStore.getState().toggleAssistant();
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("pinning a scene opens the This scene tab with it on top; null lets go", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().pinScene("gap");
    let s = usePanelStore.getState();
    expect(s.pinnedSceneId).toBe("gap");
    expect(s.activeTabId).toBe("scene");
    expect(s.open).toBe(true);
    usePanelStore.getState().pinScene(null);
    s = usePanelStore.getState();
    expect(s.pinnedSceneId).toBeNull();
    expect(s.open).toBe(true);
  });

  it("lands on the scene tab, open, while writing", () => {
    usePanelStore.getState().setSide("writing");
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().close("entity:character:c1");
    expect(usePanelStore.getState().open).toBe(true);
    expect(usePanelStore.getState().activeTabId).toBe("scene");
  });
});
