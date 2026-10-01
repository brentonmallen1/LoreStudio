import { describe, expect, it } from "vitest";
import type { CompendiumEntrySummary, DiagramSummary, StoryAsset } from "../../types";
import { indexRows, matches } from "./index";

const entry = (id: string, type: string, updated: string, extra = {}) =>
  ({
    id,
    title: id,
    entry_type: type,
    preview: "",
    tags: [],
    updated_at: updated,
    url: null,
    url_title: null,
    ...extra,
  }) as unknown as CompendiumEntrySummary;

describe("the Compendium index", () => {
  it("lists entries, images and diagrams together, newest first, leaving out non-image uploads", () => {
    const rows = indexRows(
      [
        entry("tides", "note", "2026-09-02"),
        entry("site", "url", "2026-09-05", { title: "", url_title: "Tide tables" }),
      ],
      [
        {
          id: "map",
          original_filename: "map.png",
          mime_type: "image/png",
          alt_text: "The island",
          description: "",
          updated_at: "2026-09-04",
        },
        {
          id: "pdf",
          original_filename: "log.pdf",
          mime_type: "application/pdf",
          alt_text: "",
          description: "",
          updated_at: "2026-09-09",
        },
      ] as StoryAsset[],
      [{ id: "web", title: "Who knows what", description: "", updated_at: "2026-09-03" }] as DiagramSummary[],
    );
    expect(rows.map((r) => [r.kind, r.id])).toEqual([
      ["url", "site"],
      ["image", "map"],
      ["diagram", "web"],
      ["note", "tides"],
    ]);
    expect(rows[0].title).toBe("Tide tables");
  });

  it("searches titles, previews and tags", () => {
    const [row] = indexRows(
      [entry("tides", "note", "1", { preview: "Spring tides", tags: ["sea"] })],
      [],
      [],
    );
    expect(matches(row, "SPRING")).toBe(true);
    expect(matches(row, "sea")).toBe(true);
    expect(matches(row, "lamp")).toBe(false);
    expect(matches(row, "  ")).toBe(true);
  });
});
