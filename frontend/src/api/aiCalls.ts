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

/** How a result on screen finds the call behind it. */
export interface CallLookup {
  feature: string;
  story_id?: string | null;
  node_id?: string | null;
  character_id?: string | null;
  session_id?: string | null;
}

export const aiCallsApi = {
  get: (logId: string) => request<AICall>(`/ai/calls/${logId}`),
  /** The most recent call for this feature in this context, or null if it has not run. */
  latest: (lookup: CallLookup) => {
    const params = new URLSearchParams({ feature: lookup.feature });
    for (const key of ["story_id", "node_id", "character_id", "session_id"] as const) {
      const value = lookup[key];
      if (value) params.set(key, value);
    }
    return request<AICall | null>(`/ai/calls/latest?${params}`);
  },
  /** Delete every stored prompt and response; the record that calls happened stays. */
  purgePayloads: () => request<{ removed: number }>("/ai/payloads", { method: "DELETE" }),
};
