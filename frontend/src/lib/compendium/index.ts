/**
 * The Compendium's index (doc 13 P5): research entries, images and diagrams as one list,
 * newest first, so "where did I put that?" has one place to look.
 */
import type { CompendiumEntrySummary, DiagramSummary, StoryAsset } from "../../types";

export type IndexKind = "note" | "url" | "document" | "image" | "diagram";

export interface IndexRow {
  kind: IndexKind;
  id: string;
  title: string;
  preview: string;
  tags: string[];
  updated_at: string;
}

export const KIND_LABELS: Record<IndexKind, string> = {
  note: "Notes",
  url: "Links",
  document: "Documents",
  image: "Images",
  diagram: "Diagrams",
};

export function indexRows(
  entries: CompendiumEntrySummary[],
  assets: StoryAsset[],
  diagrams: DiagramSummary[],
): IndexRow[] {
  const rows: IndexRow[] = [
    ...entries.map((e) => ({
      kind: e.entry_type as IndexKind,
      id: e.id,
      title: e.title || e.url_title || e.url || "Untitled",
      preview: e.preview,
      tags: e.tags,
      updated_at: e.updated_at,
    })),
    // Images only: a PDF uploaded to Media is a document of a different kind, not a picture.
    ...assets
      .filter((a) => a.mime_type.startsWith("image/"))
      .map((a) => ({
        kind: "image" as const,
        id: a.id,
        title: a.original_filename,
        preview: a.alt_text || a.description,
        tags: [],
        updated_at: a.updated_at,
      })),
    ...diagrams.map((d) => ({
      kind: "diagram" as const,
      id: d.id,
      title: d.title || "Untitled diagram",
      preview: d.description,
      tags: [],
      updated_at: d.updated_at,
    })),
  ];
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function matches(row: IndexRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.title, row.preview, ...row.tags].some((t) => t.toLowerCase().includes(q));
}
