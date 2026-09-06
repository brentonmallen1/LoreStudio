import { request } from "./request";

/**
 * The recorded AI call — what was actually sent and what came back (doc 06 §3).
 * Kept out of client.ts (size budget).
 */
export interface AICallPayload {
  system_prompt: string;
  messages: { role: string; content: string }[];
  raw_response: string;
  thinking: string | null;
  options: Record<string, unknown>;
  response_format: Record<string, unknown> | null;
  context_sources: { label?: string; detail?: string }[];
  error: string | null;
}

export interface AICall {
  id: string;
  feature: string;
  feature_label: string;
  classification: string | null;
  story_id: string | null;
  created_at: string;
  /** ok | error | cancelled | schema-fallback | invalid-json | schema-invalid */
  status: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  starred: boolean;
  /** null once the payload has aged out of retention, or been purged. */
  payload: AICallPayload | null;
}

export const aiCallsApi = {
  get: (logId: string) => request<AICall>(`/ai/calls/${logId}`),
  /** Delete every stored prompt and response; the record that calls happened stays. */
  purgePayloads: () => request<{ removed: number }>("/ai/payloads", { method: "DELETE" }),
};
