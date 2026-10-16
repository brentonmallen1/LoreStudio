import { request } from "./request";
import type { ImportPreviewTree } from "../types/importWizard";
import type { ImportReport } from "../types/novelcrafter";

/** What each import did (doc 28), and settling what one still has waiting. Spread into `api`. */
export const importsApi = {
  listImports: (storyId: string) => request<ImportReport[]>(`/stories/${storyId}/imports`),
  getImport: (storyId: string, recordId: string) =>
    request<ImportReport>(`/stories/${storyId}/imports/${recordId}`),
  /** Keep everything still waiting in the Compendium, or say none of it is needed: one undo. */
  settleImported: (storyId: string, recordId: string, how: "keep" | "decline") =>
    request<{ settled: number }>(`/stories/${storyId}/proposals/imported/${recordId}/${how}`, {
      method: "POST",
    }),
  /** Take back the last edit in Review structure (a rename, merge, level change or Auto-segment). */
  importUndo: (sessionId: string) =>
    request<ImportPreviewTree>(`/import/${sessionId}/undo`, { method: "POST" }),
};
