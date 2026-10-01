import { request } from "./request";
import type { User } from "../types";
import type { QuoteStyleReport } from "../types/tools";

/** Non-AI manuscript tools and per-user settings. Kept out of client.ts (size budget). */
export interface UndoState {
  can_undo: boolean;
  undo_label: string | null;
  can_redo: boolean;
  redo_label: string | null;
}

export interface UndoResult {
  label: string;
  entity_type: string;
  entity_ids: string[];
  batch_id: string;
}

export interface ChangeRow {
  seq: number;
  batch_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  label: string;
  actor_id: string | null;
  client_id: string | null;
  undoable: boolean;
  undo_of: string | null;
  redo_of: string | null;
  created_at: string | null;
}

export const toolsApi = {
  undoState: (storyId: string) => request<UndoState>(`/stories/${storyId}/undo/state`),
  undo: (storyId: string, anyClient = false) =>
    request<UndoResult>(`/stories/${storyId}/undo${anyClient ? "?any_client=true" : ""}`, { method: "POST" }),
  redo: (storyId: string, anyClient = false) =>
    request<UndoResult>(`/stories/${storyId}/redo${anyClient ? "?any_client=true" : ""}`, { method: "POST" }),
  listChanges: (storyId: string, limit = 100, beforeSeq?: number) =>
    request<ChangeRow[]>(
      `/stories/${storyId}/changes?limit=${limit}${beforeSeq ? `&before_seq=${beforeSeq}` : ""}`,
    ),
  updateMe: (body: { display_name?: string; settings?: Record<string, unknown> }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  quoteStyles: (storyId: string) => request<QuoteStyleReport>(`/stories/${storyId}/quotes`),
  normalizeQuotes: (
    storyId: string,
    body: { style: "curly" | "straight"; node_ids?: string[]; dry_run?: boolean },
  ) =>
    request<{
      style: string;
      dry_run: boolean;
      changed_chars: number;
      scenes: { node_id: string; title: string; changed: number }[];
    }>(`/stories/${storyId}/quotes/normalize`, { method: "POST", body: JSON.stringify(body) }),
};

/** Deterministic spaCy checks on chosen scenes (POST /analyze/prose-nlp). No model call. */
export const proseChecksApi = {
  run: (storyId: string, nodeIds: string[], checks: string[]) =>
    request<import("../types").ProseNLPResponse>(`/stories/${storyId}/analyze/prose-nlp`, {
      method: "POST",
      body: JSON.stringify({ node_ids: nodeIds, checks }),
    }),
};
