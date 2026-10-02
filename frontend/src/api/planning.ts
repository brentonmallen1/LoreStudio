import type { Question, QuestionSubject } from "../types/planning";
import { notesApi } from "./notes";
import { request } from "./request";

/** Open questions: notes of kind "question" (doc 15). */
export const questionsApi = {
  list: (storyId: string) => notesApi.list(storyId, { kind: "question" }) as Promise<Question[]>,
  create: (storyId: string, content: string, subject: QuestionSubject = {}) =>
    notesApi.create(storyId, { content, kind: "question", ...subject }) as Promise<Question>,
  update: (id: string, data: Partial<Pick<Question, "content" | "answer" | "done">>) =>
    notesApi.update(id, data) as Promise<Question>,
  remove: (id: string) => notesApi.remove(id),
};

export interface SuggestedName {
  name: string;
  kind: "character" | "place";
}

/** People and places named in brain-dump fragments that the story lacks (spaCy, no AI). */
export const ideasApi = {
  names: (storyId: string, texts: Record<string, string>) =>
    request<{ names: Record<string, SuggestedName[]> }>(`/stories/${storyId}/ideas/names`, {
      method: "POST",
      body: JSON.stringify({ texts }),
    }),
};
