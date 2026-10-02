import { useCallback, useEffect, useState } from "react";
import { notesApi } from "../../api/notes";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { toast } from "../../stores/toastStore";
import { KIND_LABEL } from "./kinds";
import type { Note, NoteCreate, NoteFilter, NoteUpdate } from "../../types/notes";

/** A story's notes (doc 15), optionally only those about one thing, kept fresh across undo. */
export function useStoryNotes(storyId: string | undefined, filter: NoteFilter = {}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const key = JSON.stringify(filter);
  const load = useCallback(() => {
    if (!storyId) return;
    return notesApi.list(storyId, JSON.parse(key) as NoteFilter).then(setNotes);
  }, [storyId, key]);
  useEffect(() => {
    load()?.catch(() => setNotes([]));
  }, [load]);
  useReloadOnUndo(["note"], load);

  async function add(data: NoteCreate) {
    if (!storyId || !data.content.trim()) return;
    try {
      const made = await notesApi.create(storyId, { ...data, content: data.content.trim() });
      setNotes((prev) => [...(prev ?? []), made]);
    } catch {
      toast.error("The note was not saved.");
    }
  }

  async function change(id: string, data: NoteUpdate) {
    setNotes((prev) => prev?.map((n) => (n.id === id ? { ...n, ...data } : n)) ?? prev);
    try {
      const saved = await notesApi.update(id, data);
      setNotes((prev) => prev?.map((n) => (n.id === id ? saved : n)) ?? prev);
    } catch {
      toast.error("That change was not saved.");
      void load();
    }
  }

  async function remove(id: string) {
    const gone = notes?.find((n) => n.id === id);
    setNotes((prev) => prev?.filter((n) => n.id !== id) ?? prev);
    try {
      await notesApi.remove(id);
    } catch {
      toast.error("The note was not deleted.");
      void load();
      return;
    }
    if (gone)
      toast.undoable(`${KIND_LABEL[gone.kind]} deleted.`, () =>
        notesApi.restore(gone).then(
          (back) => setNotes((prev) => [...(prev ?? []), back]),
          () => toast.error("It could not be brought back."),
        ),
      );
  }

  return { notes, add, change, remove, reload: load };
}

export type StoryNotes = ReturnType<typeof useStoryNotes>;
