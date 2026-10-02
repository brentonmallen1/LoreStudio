import type { Note, NoteCreate, NoteFilter, NoteUpdate } from "../types/notes";
import { request } from "./request";

function query(filter: NoteFilter): string {
  const params = new URLSearchParams();
  for (const kind of [filter.kind ?? []].flat()) params.append("kind", kind);
  if (filter.node_id) params.set("node_id", filter.node_id);
  if (filter.about_type && filter.about_id) {
    params.set("about_type", filter.about_type);
    params.set("about_id", filter.about_id);
  }
  if (filter.open !== undefined) params.set("open", String(filter.open));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Notes of every kind (doc 15). Every write is undoable. */
export const notesApi = {
  list: (storyId: string, filter: NoteFilter = {}) =>
    request<Note[]>(`/stories/${storyId}/notes${query(filter)}`),
  create: (storyId: string, data: NoteCreate) =>
    request<Note>(`/stories/${storyId}/notes`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: NoteUpdate) =>
    request<Note>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
  reorder: (storyId: string, noteIds: string[]) =>
    request<Note[]>(`/stories/${storyId}/notes/reorder`, {
      method: "POST",
      body: JSON.stringify({ note_ids: noteIds }),
    }),
  /** A deleted note back, as it was, under its own id (the toast's Undo). */
  restore: (n: Note) =>
    request<Note>(`/stories/${n.story_id}/notes`, {
      method: "POST",
      body: JSON.stringify({
        id: n.id,
        kind: n.kind,
        content: n.content,
        node_id: n.node_id,
        anchor: n.anchor,
        about_type: n.about_type,
        about_id: n.about_id,
        answer: n.answer,
        done: n.done,
      }),
    }),
  /** Clears ticked to-dos; answered questions keep their answers. */
  clearDone: (storyId: string) => request<void>(`/stories/${storyId}/notes/done`, { method: "DELETE" }),
};
