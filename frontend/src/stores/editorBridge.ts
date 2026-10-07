import { create } from "zustand";
import type { InlineNotesState } from "../components/editor/useInlineNotes";

/** Words to show in a scene once its prose is open (a finding's passages). */
export interface PendingPassage {
  nodeId: string;
  passages: string[];
  /** When it was asked: a request for a scene that never opened lapses. */
  at?: number;
}

/**
 * What the open editor shares with the side panel (doc 11 phase 1). The inline-notes
 * field needs the editor's live notes state, which only exists while the editor is
 * mounted; the panel reads it here and hides the field when there is no editor.
 *
 * The other way, anything can ask the editor to show some words (`showPassage`): set
 * before navigating to the scene, or while it is already open. The editor takes it once
 * that scene's prose has loaded.
 */
interface EditorBridge {
  notes: InlineNotesState | null;
  setNotes: (notes: InlineNotesState | null) => void;
  pendingPassage: PendingPassage | null;
  showPassage: (pending: PendingPassage | null) => void;
}

export const useEditorBridge = create<EditorBridge>((set) => ({
  notes: null,
  setNotes: (notes) => set({ notes }),
  pendingPassage: null,
  showPassage: (pending) => set({ pendingPassage: pending && { ...pending, at: Date.now() } }),
}));
