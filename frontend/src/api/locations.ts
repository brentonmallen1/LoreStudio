import type { Location } from "../types";
import { request } from "./request";

export const locationsApi = {
  /** "Same as…" (doc 13 P4): fold a found place into another; one Undo reverses it. */
  merge: (locationId: string, into: string) =>
    request<Location>(`/locations/${locationId}/merge`, { method: "POST", body: JSON.stringify({ into }) }),
};
