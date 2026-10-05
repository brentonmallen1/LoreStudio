import { describe, expect, it } from "vitest";
import type { SeriesSummary } from "../../api/series";
import type { Story } from "../../types";
import { dashboardSegments } from "./dashboard";

const story = (id: string, updated: string) => ({ id, title: id, updated_at: updated }) as Story;
const book = (story_id: string, position: number) => ({
  story_id,
  title: story_id,
  position,
  updated_at: null,
});

describe("dashboardSegments", () => {
  it("keeps the page as it was when there is no series", () => {
    const out = dashboardSegments([story("a", "2026-01-01"), story("b", "2026-02-01")], []);
    expect(out).toEqual([{ type: "stories", stories: [story("b", "2026-02-01"), story("a", "2026-01-01")] }]);
  });

  it("puts a series where its latest book would be, books in series order", () => {
    const series: SeriesSummary = { id: "s", name: "Keepers", books: [book("one", 0), book("two", 1)] };
    const out = dashboardSegments(
      [
        story("one", "2026-01-01"),
        story("lone", "2026-03-01"),
        story("two", "2026-02-01"),
        story("old", "2025-01-01"),
      ],
      [series],
    );
    expect(out.map((s) => s.type)).toEqual(["stories", "series", "stories"]);
    const group = out[1];
    expect(group.type === "series" && group.books.map((b) => b.id)).toEqual(["one", "two"]);
    expect(out[2].type === "stories" && out[2].stories.map((s) => s.id)).toEqual(["old"]);
  });

  it("places a series with no books yet by its own last edit", () => {
    const planned: SeriesSummary = { id: "p", name: "Planned", books: [], updated_at: "2026-02-15" };
    const out = dashboardSegments([story("a", "2026-01-01"), story("b", "2026-03-01")], [planned]);
    expect(out.map((s) => s.type)).toEqual(["stories", "series", "stories"]);
    expect(out[1].type === "series" && out[1].books).toEqual([]);
  });

  it("skips books it has not loaded", () => {
    const series: SeriesSummary = { id: "s", name: "Keepers", books: [book("one", 0), book("gone", 1)] };
    const out = dashboardSegments([story("one", "2026-01-01")], [series]);
    expect(out[0].type === "series" && out[0].books.map((b) => b.id)).toEqual(["one"]);
  });
});
