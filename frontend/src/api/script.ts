import { request } from "./request";
import type { StructureNode } from "../types";
import type { ScriptExportChoices, ScriptLayout } from "../types/script";

/** A screenplay's own calls (doc 25). Kept out of client.ts (size budget). */
export const scriptApi = {
  /** Start a new scene at a script scene's second heading (doc 25, D3): one undoable change. */
  splitNode: (nodeId: string, data: { content: string; new_content: string; expected_updated_at?: string }) =>
    request<StructureNode>(`/structure/${nodeId}/split`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Start a scene at every heading below a scene's own (several pasted at once, doc 25 P6):
   *  one undoable change. Returns the scene as it now reads. */
  splitAtHeadings: (nodeId: string, expected_updated_at?: string) =>
    request<StructureNode>(`/structure/${nodeId}/split-headings`, {
      method: "POST",
      body: JSON.stringify({ expected_updated_at }),
    }),
  /** A screenplay's printed pages, line by line: the PDF's own layout (doc 25, P3). */
  getScriptLayout: (storyId: string, choices: ScriptExportChoices, statusFilter?: string) => {
    const q = new URLSearchParams(Object.entries(choices).map(([k, v]) => [k, String(v)]));
    if (statusFilter) q.set("status_filter", statusFilter);
    return request<ScriptLayout>(`/stories/${storyId}/script-layout?${q}`);
  },
};
