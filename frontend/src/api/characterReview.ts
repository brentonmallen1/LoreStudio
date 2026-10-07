import type { Character } from "../types";
import { request } from "./request";

/** The review step (doc 20 P3): a new pronoun set or name, followed through the prose. */
export interface ReviewEdit {
  start: number;
  end: number;
  text: string;
  was: string;
}

export interface ReviewItem {
  id: string;
  node_id: string;
  para: number;
  kind: "pronoun" | "gendered" | "name";
  sure: boolean;
  sent_start: number;
  sent_end: number;
  before: string;
  after: string;
  edits: ReviewEdit[];
  note: string;
  /** Careful (Studio): the Assistant identified this one (R5). */
  careful?: boolean;
}

export interface ReviewScene {
  node_id: string;
  title: string;
  updated_at: string;
}

export interface Review {
  items: ReviewItem[];
  scenes: ReviewScene[];
  unsupported: string;
}

export interface ReviewRequest {
  pronouns_from?: string;
  pronouns_to?: string;
  name_from?: string;
  name_to?: string;
  slips?: boolean;
}

export interface ApplyItem extends Pick<
  ReviewItem,
  "node_id" | "para" | "sent_start" | "sent_end" | "before" | "edits"
> {
  hand?: string;
}

export interface Applied {
  character: Character;
  applied: number;
  skipped: string[];
  not_placed: number;
}

export const characterReviewApi = {
  review: (characterId: string, body: ReviewRequest) =>
    request<Review>(`/characters/${characterId}/review`, { method: "POST", body: JSON.stringify(body) }),
  apply: (
    characterId: string,
    body: { pronouns?: string; name?: string; items: ApplyItem[]; seen: Record<string, string> },
  ) =>
    request<Applied>(`/characters/${characterId}/review/apply`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
