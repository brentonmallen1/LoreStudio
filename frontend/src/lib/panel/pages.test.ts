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
  it("offers every page but the prose and Freewrite, and Studio's only in Studio", () => {
    const writer = besideRoutes("writer", false).map((r) => r.id);
    const studio = besideRoutes("studio", true).map((r) => r.id);
    expect(writer).not.toContain("write");
    expect(writer).not.toContain("freewrite");
    expect(writer).toContain("storyboard");
    expect(writer).not.toContain("publish");
    expect(studio).toContain("publish");
  });

  it("finds the page and the section a path is on", () => {
    expect(routeAt("")?.id).toBe("overview");
    expect(routeAt("/")?.id).toBe("overview");
    expect(routeAt("/storyboard")?.id).toBe("storyboard");
    expect(routeAt("/lorebook/places/p1")?.id).toBe("lorebook");
    expect(routeAt("/write/n1/sheet")?.id).toBe("write");
    const lorebook = findRoute("lorebook")!;
    expect(sectionAt(lorebook, "/lorebook")?.id).toBe("identity");
    expect(sectionAt(lorebook, "/lorebook/places/p1")?.id).toBe("places");
  });

  it("keeps a move inside the page in the tab, and sends the rest to the main window", () => {
    expect(staysInPage("lorebook", "/lorebook/characters/c1")).toBe(true);
    expect(staysInPage("storyboard", "/write/n1")).toBe(false);
    expect(staysInPage("overview", "/storyboard")).toBe(false);
    expect(staysInPage("overview", "")).toBe(true);
  });

  it("reads a path relative to its story", () => {
    expect(storyRelative("s1", "/stories/s1")).toBe("");
    expect(storyRelative("s1", "/stories/s1/storyboard")).toBe("/storyboard");
    expect(storyRelative("s1", "/stories/s10/storyboard")).toBeNull();
    expect(storyRelative("s1", "/settings")).toBeNull();
  });

  it("names a page tab for its page, with the section in the tooltip", () => {
    expect(pageTabLabel("lorebook", "/lorebook/places")).toEqual({
      label: "Lorebook",
      title: "Lorebook › Places",
    });
    expect(pageTabLabel("storyboard", "/storyboard")).toEqual({ label: "Storyboard", title: "Storyboard" });
  });

  it("opens at the page or one of its sections", () => {
    expect(besidePath("storyboard")).toBe("/storyboard");
    expect(besidePath("lorebook", "places")).toBe("/lorebook/places");
    expect(besidePath("overview")).toBe("");
    expect(besidePath("write")).toBeNull();
  });
});
