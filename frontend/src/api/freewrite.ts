import { request } from "./request";

/** The story's Freewrite page (doc 15 N3): HTML from its editor. */
export const freewriteApi = {
  get: (storyId: string) => request<{ html: string }>(`/stories/${storyId}/freewrite`),
  put: (storyId: string, html: string) =>
    request<{ html: string }>(`/stories/${storyId}/freewrite`, {
      method: "PUT",
      body: JSON.stringify({ html }),
    }),
};
