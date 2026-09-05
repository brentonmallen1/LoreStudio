import { request } from "./request";
import type { User } from "../types";
import type { ConsistencyFinding, QuoteStyleReport } from "../types/tools";

/** Non-AI manuscript tools and per-user settings. Kept out of client.ts (size budget). */
export const toolsApi = {
  updateMe: (body: { display_name?: string; settings?: Record<string, unknown> }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  consistencyChecks: (storyId: string, nodeId?: string) =>
    request<{ findings: ConsistencyFinding[] }>(
      `/stories/${storyId}/consistency${nodeId ? `?node_id=${encodeURIComponent(nodeId)}` : ""}`,
    ),
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
