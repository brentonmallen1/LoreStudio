import { describe, expect, it } from "vitest";
import {
  besidePath,
  besideRoutes,
  pageTabLabel,
  routeAt,
  sectionAt,
  staysInPage,
  storyRelative,
} from "./pages";
import { findRoute } from "../routes";

describe("pages beside the prose", () => {
  it("offers every page but the prose, and Studio's only in Studio", () => {
    const writer = besideRoutes("writer", false).map((r) => r.id);
    const studio = besideRoutes("studio", true).map((r) => r.id);
    expect(writer).not.toContain("write");
    expect(writer).toContain("freewrite"); // the rail opens it as a tab
    expect(writer).toContain("summaries");
    expect(writer).toContain("outline"); // the same lines, narrow, with the scene being written marked
    expect(writer).not.toContain("publish");
    expect(studio).toContain("publish");
  });

  it("finds the page and the section a path is on", () => {
    expect(routeAt("")?.id).toBe("overview");
    expect(routeAt("/")?.id).toBe("overview");
    expect(routeAt("/outline")?.id).toBe("outline");
    expect(routeAt("/lorebook/places/p1")?.id).toBe("lorebook");
    expect(routeAt("/write/n1/sheet")?.id).toBe("write");
    const lorebook = findRoute("lorebook")!;
    expect(sectionAt(lorebook, "/lorebook")?.id).toBe("identity");
    expect(sectionAt(lorebook, "/lorebook/places/p1")?.id).toBe("places");
  });

  it("keeps a move inside the page in the tab, and sends the rest to the main window", () => {
    expect(staysInPage("lorebook", "/lorebook/characters/c1")).toBe(true);
    expect(staysInPage("outline", "/write/n1")).toBe(false);
    expect(staysInPage("overview", "/outline")).toBe(false);
    expect(staysInPage("overview", "")).toBe(true);
  });

  it("reads a path relative to its story", () => {
    expect(storyRelative("s1", "/stories/s1")).toBe("");
    expect(storyRelative("s1", "/stories/s1/outline")).toBe("/outline");
    expect(storyRelative("s1", "/stories/s10/outline")).toBeNull();
    expect(storyRelative("s1", "/settings")).toBeNull();
  });

  it("names a page tab for its page, with the section in the tooltip", () => {
    expect(pageTabLabel("lorebook", "/lorebook/places")).toEqual({
      label: "Lorebook",
      title: "Lorebook › Places",
    });
    expect(pageTabLabel("outline", "/outline")).toEqual({ label: "Outline", title: "Outline" });
  });

  it("opens at the page or one of its sections", () => {
    expect(besidePath("outline")).toBe("/outline");
    expect(besidePath("lorebook", "places")).toBe("/lorebook/places");
    expect(besidePath("overview")).toBe("");
    expect(besidePath("write")).toBeNull();
  });
});
