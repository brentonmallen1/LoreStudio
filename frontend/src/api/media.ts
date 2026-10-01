import type { StoryAsset } from "../types";
import { BASE, getClientId, getToken } from "./request";

/** Image files (doc 14 Q5). The upload is a form, so it skips `request`'s JSON header. */
export const mediaApi = {
  /** A new file for the same image: its caption, note and every use stay. */
  replaceFile: async (assetId: string, file: File): Promise<StoryAsset> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/media/${assetId}/file`, {
      method: "PUT",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "X-Client-Id": getClientId() },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail ?? "The file could not be replaced");
    }
    return res.json();
  },
};
