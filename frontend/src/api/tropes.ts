import { request } from "./request";
import type { Trope, TropeLink, TropeLinkTarget, TropeStance } from "../types/tropes";

type TropeFields = {
  name: string;
  stance: TropeStance;
  why: string;
  thread_id: string | null;
  definition_id: string | null;
};

/** Tropes in play (doc 27). Spread into `api`. */
export const tropesApi = {
  listTropes: (storyId: string) => request<Trope[]>(`/stories/${storyId}/tropes`),
  createTrope: (storyId: string, data: Partial<TropeFields> & { name: string }) =>
    request<Trope>(`/stories/${storyId}/tropes`, { method: "POST", body: JSON.stringify(data) }),
  updateTrope: (tropeId: string, data: Partial<TropeFields>) =>
    request<Trope>(`/tropes/${tropeId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTrope: (tropeId: string) => request<void>(`/tropes/${tropeId}`, { method: "DELETE" }),
  reorderTropes: (storyId: string, ids: string[]) =>
    request<Trope[]>(`/stories/${storyId}/tropes/reorder`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  /** Play the trope somewhere; playing it where it already plays returns that link. */
  addTropeLink: (tropeId: string, target: TropeLinkTarget, note = "") =>
    request<TropeLink>(`/tropes/${tropeId}/links`, {
      method: "POST",
      body: JSON.stringify({ ...target, note }),
    }),
  updateTropeLink: (linkId: string, note: string) =>
    request<TropeLink>(`/trope-links/${linkId}`, { method: "PATCH", body: JSON.stringify({ note }) }),
  removeTropeLink: (linkId: string) => request<void>(`/trope-links/${linkId}`, { method: "DELETE" }),
  sceneTropes: (nodeId: string) => request<Trope[]>(`/structure/${nodeId}/tropes`),
  characterTropes: (characterId: string) => request<Trope[]>(`/characters/${characterId}/tropes`),
};
