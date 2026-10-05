import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "./panelStore";

/** One choice for every page: moving between the prose and the other pages never changes it. */
describe("panel open across pages", () => {
  beforeEach(() => {
    usePanelStore.setState({ side: "writing", open: false });
  });

  it("stays collapsed going back to the prose", () => {
    const { setSide } = usePanelStore.getState();
    setSide("pages");
    setSide("writing");
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("stays open across pages once the author opens it", () => {
    usePanelStore.getState().setSide("pages");
    usePanelStore.getState().openTool("characters");
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(true);
  });

  it("a collapse holds everywhere", () => {
    usePanelStore.getState().setOpen(true);
    usePanelStore.getState().toggle();
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(false);
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
    expect(s.activeTabId).toBe("scene");
  });

  it("opens a tab behind the one showing, so several can be opened from a list", () => {
    usePanelStore.getState().openTool("characters");
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance", true);
    usePanelStore.getState().openEntity("character", "c2", "Thomas Vance", true);
    const s = usePanelStore.getState();
    expect(s.activeTabId).toBe("tool:characters");
    expect(s.tabs.map((t) => t.id)).toEqual([
      "scene",
      "tool:characters",
      "entity:character:c1",
      "entity:character:c2",
    ]);
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
