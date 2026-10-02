import { request } from "./request";

/** The story's Freewrite page (doc 15 N3): HTML from its editor. */
export const freewriteApi = {
  get: (storyId: string) => request<{ html: string }>(`/stories/${storyId}/freewrite`),
  put: (storyId: string, html: string) =>
    request<{ html: string }>(`/stories/${storyId}/freewrite`, {
      method: "PUT",
      body: JSON.stringify({ html }),
    }),
  /** Plain text to the end of the page, under `day`'s heading (the scratch pad's "Send to a story"). */
  append: (storyId: string, text: string, day: string) =>
    request<{ html: string }>(`/stories/${storyId}/freewrite/append`, {
      method: "POST",
      body: JSON.stringify({ text, day }),
    }),
};
