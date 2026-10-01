import type { Interview, PanelInterview } from "../types";
import { request } from "./request";

/**
 * Interviews and group interviews keep their history on the server, so starting over and
 * compacting happen there too (doc 13 P1); the Chronicle keeps every transcript.
 */
export const conversationsApi = {
  clearInterview: (id: string) => request<Interview>(`/interviews/${id}/clear`, { method: "POST" }),
  compactInterview: (id: string) => request<Interview>(`/interviews/${id}/compact`, { method: "POST" }),
  getInterview: (id: string) => request<Interview>(`/interviews/${id}`),
  clearPanel: (id: string) => request<PanelInterview>(`/panels/${id}/clear`, { method: "POST" }),
  compactPanel: (id: string) => request<PanelInterview>(`/panels/${id}/compact`, { method: "POST" }),
};
