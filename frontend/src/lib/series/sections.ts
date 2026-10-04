/**
 * The series page's sections (v1.5), each its own path under /series/:id, its own view in the
 * page header, and its own palette command (lib/commands/series.ts).
 */
export const SERIES_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "canon", label: "Canon" },
  { id: "promises", label: "Promises" },
  { id: "story-so-far", label: "The story so far" },
  { id: "research", label: "Shared research" },
] as const;

export type SeriesSection = (typeof SERIES_SECTIONS)[number]["id"];

export function seriesSection(param: string | undefined): SeriesSection {
  return SERIES_SECTIONS.find((s) => s.id === param)?.id ?? "overview";
}

export function seriesPath(seriesId: string, section: SeriesSection = "overview", hash = ""): string {
  return `/series/${seriesId}${section === "overview" ? "" : `/${section}`}${hash ? `#${hash}` : ""}`;
}
