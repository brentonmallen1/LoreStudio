import { create } from "zustand";
import type { InlineNotesState } from "../components/editor/useInlineNotes";
import type { ScriptElement } from "../lib/script/syntax";

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
  /** Open the image picker in the open scene (the palette's Insert image); null with no editor. */
  insertImage: (() => void) | null;
  setInsertImage: (open: (() => void) | null) => void;
  /** Put the cursor at the start of a block of a scene about to open (a split's new scene). */
  openAt: { nodeId: string; block: number } | null;
  setOpenAt: (at: { nodeId: string; block: number } | null) => void;
  /** Set the element of the line the cursor is in, while a script scene is open (doc 25). */
  scriptElement: ((el: ScriptElement) => void) | null;
  setScriptElement: (fn: ((el: ScriptElement) => void) | null) => void;
  /** Speak the line's speech at the same time as the one before it, or not (doc 25, P8). */
  scriptDual: (() => "on" | "off" | "none") | null;
  setScriptDual: (fn: (() => "on" | "off" | "none") | null) => void;
}

export const useEditorBridge = create<EditorBridge>((set) => ({
  notes: null,
  setNotes: (notes) => set({ notes }),
  pendingPassage: null,
  showPassage: (pending) => set({ pendingPassage: pending && { ...pending, at: Date.now() } }),
  openAt: null,
  setOpenAt: (openAt) => set({ openAt }),
  insertImage: null,
  setInsertImage: (insertImage) => set({ insertImage }),
  scriptElement: null,
  setScriptElement: (fn) => set({ scriptElement: fn }),
  scriptDual: null,
  setScriptDual: (fn) => set({ scriptDual: fn }),
}));
