import { request } from "./request";

/**
 * Codex: the story's knowledge graph and its semantic index (doc 07).
 * Kept out of client.ts (size budget).
 */
export interface CodexIndexStats {
  chunks: number;
  embedded: number;
  pending: number;
  tokens: number;
  bytes: number;
  dim: number;
  models: string[];
  /** "sqlite-vec" or "python" — which one actually answers a search here. */
  backend: string;
  effective_embed_model: string;
}

export interface CodexSettings {
  embed_model: string | null;
  effective_embed_model: string;
  search_backend: string;
}

export const codexApi = {
  settings: () => request<CodexSettings>("/codex/settings"),
  updateSettings: (embedModel: string | null) =>
    request<CodexSettings>("/codex/settings", {
      method: "PATCH",
      body: JSON.stringify({ embed_model: embedModel }),
    }),
  indexStats: (storyId: string) => request<CodexIndexStats>(`/stories/${storyId}/codex/index`),
  reindex: (storyId: string) =>
    request<{ job_id: string }>(`/stories/${storyId}/codex/index`, { method: "POST" }),
  sync: (storyId: string) =>
    request<{ job_id: string }>(`/stories/${storyId}/codex/sync`, { method: "POST" }),
};
