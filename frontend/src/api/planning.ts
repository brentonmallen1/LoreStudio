import type { Question, QuestionSubject } from "../types/planning";
import { request } from "./request";

/** Open questions: TODO rows of kind "question" (refactor doc 10 P3). */
export const questionsApi = {
  list: (storyId: string) => request<Question[]>(`/stories/${storyId}/todos?kind=question`),
  create: (storyId: string, content: string, subject: QuestionSubject = {}) =>
    request<Question>(`/stories/${storyId}/todos`, {
      method: "POST",
      body: JSON.stringify({ content, kind: "question", ...subject }),
    }),
  update: (id: string, data: Partial<Pick<Question, "content" | "answer" | "done">>) =>
    request<Question>(`/todos/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/todos/${id}`, { method: "DELETE" }),
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
