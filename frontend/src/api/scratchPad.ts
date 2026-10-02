import { request } from "./request";

/** The scratch pad (doc 15 N4): one page on the account, belonging to no story. */
export const scratchPadApi = {
  get: () => request<{ html: string }>("/auth/me/scratch-pad"),
  put: (html: string) =>
    request<{ html: string }>("/auth/me/scratch-pad", { method: "PUT", body: JSON.stringify({ html }) }),
};
