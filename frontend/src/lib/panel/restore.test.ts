import { describe, expect, it } from "vitest";
import { restorePanel } from "./restore";

const eleanor = {
  id: "entity:character:c1",
  kind: "entity",
  entityKind: "character",
  entityId: "c1",
  label: "Eleanor",
};

/** Whatever is in `ls_panel:<story>`, the panel comes back without a crash (doc 24 D11). */
describe("restorePanel", () => {
  it("starts on This scene with nothing saved, or with junk", () => {
    for (const raw of [null, undefined, 3, "x", [], { tabs: "no" }, { tabs: [null, 4, {}] }]) {
      expect(restorePanel(raw)).toEqual({ tabs: [], showing: "scene" });
    }
  });

  it("reads the shape from before: drops the scene and tool tabs, keeps a tool showing", () => {
    const raw = {
      tabs: [{ id: "tool:notes", kind: "tool", tool: "notes" }, eleanor],
      activeTabId: "tool:notes",
    };
    expect(restorePanel(raw)).toEqual({ tabs: [eleanor], showing: "tool:notes" });
  });

  it("falls back to This scene for a tool since renamed, or a tab no longer there", () => {
    expect(restorePanel({ tabs: [], activeTabId: "tool:questions" }).showing).toBe("scene");
    expect(restorePanel({ tabs: [], showing: "entity:character:gone" }).showing).toBe("scene");
  });

  it("keeps the Assistant showing, and an entity tab", () => {
    expect(restorePanel({ tabs: [eleanor], showing: "assistant" }).showing).toBe("assistant");
    expect(restorePanel({ tabs: [eleanor], showing: eleanor.id }).showing).toBe(eleanor.id);
  });

  it("keeps page tabs for pages that open beside the prose, at a path inside the page", () => {
    const raw = {
      tabs: [
        { id: "page:storyboard", kind: "page", routeId: "storyboard", path: "/storyboard" },
        { id: "page:lorebook", kind: "page", routeId: "lorebook", path: "/elsewhere" },
        { id: "page:write", kind: "page", routeId: "write", path: "/write" },
        { id: "page:gone", kind: "page", routeId: "gone", path: "/gone" },
      ],
      showing: "page:write",
    };
    expect(restorePanel(raw)).toEqual({
      tabs: [
        { id: "page:storyboard", kind: "page", routeId: "storyboard", path: "/storyboard" },
        { id: "page:lorebook", kind: "page", routeId: "lorebook", path: "/lorebook" },
      ],
      showing: "scene",
    });
  });

  it("drops a second tab with the same id", () => {
    expect(restorePanel({ tabs: [eleanor, eleanor] }).tabs).toEqual([eleanor]);
  });
});
