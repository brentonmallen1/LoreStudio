import { create } from "zustand";
import type { InlineNotesState } from "../components/editor/useInlineNotes";

/**
 * What the open editor shares with the side panel (doc 11 phase 1). The inline-notes
 * field needs the editor's live notes state, which only exists while the editor is
 * mounted; the panel reads it here and hides the field when there is no editor.
 */
interface EditorBridge {
  notes: InlineNotesState | null;
  setNotes: (notes: InlineNotesState | null) => void;
}

export const useEditorBridge = create<EditorBridge>((set) => ({
  notes: null,
  setNotes: (notes) => set({ notes }),
}));
