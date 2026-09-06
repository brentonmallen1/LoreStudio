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

export interface CodexSuggestion {
  id: string;
  /** "presence" | "fact" — what confirming this writes into the Lorebook. */
  kind: string;
  statement: string;
  /** The words in the scene it was read from. */
  quote: string;
  confidence: number;
  scene_id: string | null;
  scene_title: string;
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
  suggestions: (storyId: string) => request<CodexSuggestion[]>(`/stories/${storyId}/codex/suggestions`),
  suggest: (storyId: string) =>
    request<{ job_id: string }>(`/stories/${storyId}/codex/suggest`, { method: "POST" }),
  review: (storyId: string, ids: string[], accept: boolean) =>
    request<{ reviewed: number }>(`/stories/${storyId}/codex/suggestions/${accept ? "confirm" : "reject"}`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};
