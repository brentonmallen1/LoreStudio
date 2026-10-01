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

export interface CodexNode {
  id: string;
  kind: string;
  label: string;
  summary: string;
  ref_id: string;
  props: Record<string, unknown>;
}

export interface CodexEdge {
  id: string;
  kind: string;
  src_id: string;
  dst_id: string;
  props: Record<string, unknown>;
  /** "author" | "derived" | "llm" — llm edges are proposals, drawn dashed. */
  source: string;
  confidence: number;
}

export interface CodexGraph {
  nodes: CodexNode[];
  edges: CodexEdge[];
  counts: Record<string, number>;
}

export interface CodexEdgeDetail {
  id: string;
  kind: string;
  direction: string;
  other_id: string;
  other_kind: string;
  other_label: string;
  other_ref_id: string;
  source: string;
  confidence: number;
  props: Record<string, unknown>;
}

export interface CodexNodeDetail {
  node: CodexNode;
  edges: CodexEdgeDetail[];
  chunks: number;
  embedded: number;
  tokens: number;
  ai_calls: number;
}

export interface ScenePresenceRow {
  character_id: string;
  name: string;
  /** pov | participant | mentioned | absent */
  role: string | null;
  /** pov | dialogue | mention | manual — how the Codex worked it out. */
  basis: string | null;
  overridden: boolean;
}

export interface ScenePresenceRead {
  synced: boolean;
  characters: ScenePresenceRow[];
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
  graph: (storyId: string) => request<CodexGraph>(`/stories/${storyId}/codex`),
  node: (storyId: string, nodeId: string) =>
    request<CodexNodeDetail>(`/stories/${storyId}/codex/nodes/${nodeId}`),
  presence: (storyId: string, nodeId: string) =>
    request<ScenePresenceRead>(`/stories/${storyId}/codex/presence/${nodeId}`),
  setPresence: (storyId: string, nodeId: string, characterId: string, role: string) =>
    request<{ role: string; source: string }>(`/stories/${storyId}/codex/presence`, {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId, character_id: characterId, role }),
    }),
};
