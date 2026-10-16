import { request } from "./request";
import type { StructuredResult, StructureNode, TrayItem } from "../types";

/** The Outline's Not placed yet tray (doc 29 D3). Every write records a change for ⌘Z. */
export const trayApi = {
  list: (storyId: string) => request<TrayItem[]>(`/stories/${storyId}/tray`),
  add: (storyId: string, text: string, position?: number) =>
    request<TrayItem>(`/stories/${storyId}/tray`, {
      method: "POST",
      body: JSON.stringify({ text, ...(position === undefined ? {} : { position }) }),
    }),
  /** Several at once, one change: the picks of Fill the tray from my prose. */
  addMany: (storyId: string, items: { text: string; notes?: string }[]) =>
    request<TrayItem[]>(`/stories/${storyId}/tray/many`, { method: "POST", body: JSON.stringify({ items }) }),
  edit: (itemId: string, data: { text?: string; notes?: string }) =>
    request<TrayItem>(`/tray-items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (itemId: string) => request<void>(`/tray-items/${itemId}`, { method: "DELETE" }),
  reorder: (storyId: string, itemIds: string[]) =>
    request<void>(`/stories/${storyId}/tray/reorder`, {
      method: "POST",
      body: JSON.stringify({ item_ids: itemIds }),
    }),
  /** The idea becomes a planned scene at that spot and leaves the tray: one change. */
  place: (
    itemId: string,
    spot: { parent_id: string | null; position: number; level: number; level_type: string },
  ) => request<StructureNode>(`/tray-items/${itemId}/place`, { method: "POST", body: JSON.stringify(spot) }),
  /** Studio: the written scenes' key moments as ideas to pick (kept on the story). */
  fromProse: (storyId: string) =>
    request<StructuredResult>(`/stories/${storyId}/tray/from-prose`, { method: "POST" }),
};
