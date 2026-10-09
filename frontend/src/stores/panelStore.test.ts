import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "./panelStore";

/**
 * Off the prose the panel starts collapsed (doc 24); beside the prose it is as the author
 * left it there, whatever happened on the pages in between.
 */
describe("panel open across pages", () => {
  beforeEach(() => {
    localStorage.clear();
    usePanelStore.setState({ side: "writing", open: false, frame: "docked" });
  });

  it("collapses on a page and comes back open at the prose", () => {
    usePanelStore.getState().setOpen(true);
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(false);
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(true);
  });

  it("opened on a page, stays open from page to page, and the prose keeps its own choice", () => {
    usePanelStore.getState().setSide("pages");
    usePanelStore.getState().openTool("characters");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("a collapse beside the prose holds there", () => {
    usePanelStore.getState().setOpen(true);
    usePanelStore.getState().toggle();
    usePanelStore.getState().setSide("pages");
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("leaves a panel popped out to its own window alone", () => {
    usePanelStore.setState({ frame: "window", open: true });
    usePanelStore.getState().setSide("pages");
    expect(usePanelStore.getState().open).toBe(true);
  });
});

/**
 * Off the prose This scene is not something you opened, so closing what you did open shuts
 * the panel. It used to fall back to the scene tab and stay open on every page.
 */
describe("closing back to the scene", () => {
  beforeEach(() => {
    usePanelStore.setState({ side: "pages", open: false, tabs: [], showing: "scene" });
  });

  it("collapses the panel on a page when the last tab you opened closes", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    expect(usePanelStore.getState().open).toBe(true);
    usePanelStore.getState().close("entity:character:c1");
    const s = usePanelStore.getState();
    expect(s.open).toBe(false);
    expect(s.showing).toBe("scene");
  });

  it("opens tabs behind the tool showing, so several can be opened from its list", () => {
    usePanelStore.getState().openTool("characters");
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance", true);
    usePanelStore.getState().openEntity("character", "c2", "Thomas Vance", true);
    const s = usePanelStore.getState();
    expect(s.showing).toBe("tool:characters");
    expect(s.tabs.map((t) => t.id)).toEqual(["entity:character:c1", "entity:character:c2"]);
  });

  it("closing a tab not showing leaves what is showing", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().openEntity("character", "c2", "Thomas Vance");
    usePanelStore.getState().close("entity:character:c1");
    const s = usePanelStore.getState();
    expect(s.showing).toBe("entity:character:c2");
    expect(s.tabs.map((t) => t.id)).toEqual(["entity:character:c2"]);
  });

  it("closing the tab showing lands on its neighbour", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().openEntity("character", "c2", "Thomas Vance");
    usePanelStore.getState().activate("entity:character:c1");
    usePanelStore.getState().close("entity:character:c1");
    expect(usePanelStore.getState().showing).toBe("entity:character:c2");
    expect(usePanelStore.getState().open).toBe(true);
  });

  it("collapses on a page when the Assistant closes or is toggled away", () => {
    usePanelStore.getState().openAssistant();
    usePanelStore.getState().close("assistant");
    expect(usePanelStore.getState().open).toBe(false);
    usePanelStore.getState().openAssistant();
    usePanelStore.getState().toggleAssistant();
    expect(usePanelStore.getState().open).toBe(false);
  });

  it("pinning a scene shows This scene with it on top; null lets go", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().pinScene("gap");
    let s = usePanelStore.getState();
    expect(s.pinnedSceneId).toBe("gap");
    expect(s.showing).toBe("scene");
    expect(s.open).toBe(true);
    usePanelStore.getState().pinScene(null);
    s = usePanelStore.getState();
    expect(s.pinnedSceneId).toBeNull();
    expect(s.open).toBe(true);
  });

  it("lands on the scene, open, while writing", () => {
    usePanelStore.getState().setSide("writing");
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().close("entity:character:c1");
    expect(usePanelStore.getState().open).toBe(true);
    expect(usePanelStore.getState().showing).toBe("scene");
  });
});

/** The rail launches and the tabs hold (doc 24 D11). */
describe("launchers and tabs", () => {
  beforeEach(() => {
    localStorage.clear();
    usePanelStore.setState({ storyId: "s1", side: "writing", open: false, tabs: [], showing: "scene" });
  });

  it("shows a tool from the rail without adding a tab", () => {
    usePanelStore.getState().launch("dialogue");
    const s = usePanelStore.getState();
    expect(s.showing).toBe("tool:dialogue");
    expect(s.open).toBe(true);
    expect(s.tabs).toEqual([]);
  });

  it("keeps the tabs you opened while a launcher shows, and goes back to them", () => {
    usePanelStore.getState().openEntity("character", "c1", "Eleanor Vance");
    usePanelStore.getState().launch("scene");
    expect(usePanelStore.getState().tabs.map((t) => t.id)).toEqual(["entity:character:c1"]);
    expect(usePanelStore.getState().highlight).toBeNull();
    usePanelStore.getState().activate("entity:character:c1");
    expect(usePanelStore.getState().highlight?.name).toBe("Eleanor Vance");
  });

  it("closing a tool leaves it for This scene, and This scene does not close", () => {
    usePanelStore.getState().launch("notes");
    usePanelStore.getState().close("tool:notes");
    expect(usePanelStore.getState().showing).toBe("scene");
    usePanelStore.getState().close("scene");
    expect(usePanelStore.getState().showing).toBe("scene");
  });

  it("opens a page beside the prose as a tab, one per page", () => {
    usePanelStore.getState().openPage("storyboard");
    usePanelStore.getState().openPage("lorebook", "places");
    usePanelStore.getState().openPage("lorebook", "characters");
    const s = usePanelStore.getState();
    expect(s.tabs).toEqual([
      { id: "page:storyboard", kind: "page", routeId: "storyboard", path: "/storyboard" },
      { id: "page:lorebook", kind: "page", routeId: "lorebook", path: "/lorebook/characters" },
    ]);
    expect(s.showing).toBe("page:lorebook");
  });

  it("does not open the prose beside itself", () => {
    usePanelStore.getState().openPage("write");
    expect(usePanelStore.getState().tabs).toEqual([]);
  });

  it("a page opened from another page is open waiting at the prose", () => {
    usePanelStore.setState({ side: "pages" });
    usePanelStore.getState().openPage("storyboard");
    usePanelStore.getState().setSide("writing");
    expect(usePanelStore.getState().open).toBe(true);
    expect(usePanelStore.getState().showing).toBe("page:storyboard");
  });

  it("remembers where a page tab moved to, and saves it with the story", () => {
    usePanelStore.getState().openPage("lorebook");
    usePanelStore.getState().setPagePath("page:lorebook", "/lorebook/places/p1");
    const saved = JSON.parse(localStorage.getItem("ls_panel:s1")!);
    expect(saved).toEqual({
      tabs: [{ id: "page:lorebook", kind: "page", routeId: "lorebook", path: "/lorebook/places/p1" }],
      showing: "page:lorebook",
    });
  });

  it("comes back from what an older version saved", () => {
    localStorage.setItem(
      "ls_panel:s2",
      JSON.stringify({
        tabs: [
          { id: "tool:characters", kind: "tool", tool: "characters" },
          {
            id: "entity:character:c1",
            kind: "entity",
            entityKind: "character",
            entityId: "c1",
            label: "Eleanor",
          },
        ],
        activeTabId: "tool:characters",
      }),
    );
    usePanelStore.getState().loadForStory("s2");
    const s = usePanelStore.getState();
    expect(s.tabs.map((t) => t.id)).toEqual(["entity:character:c1"]);
    expect(s.showing).toBe("tool:characters");
  });
});
