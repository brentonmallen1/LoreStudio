/**
 * The open scene's editor, as one of the two histories ⌘Z reaches (doc 23 P5b).
 *
 * Its own history (prosemirror-history) holds the author's typing and nothing else. Text that
 * arrives from outside, opening a scene or a rewrite on the server, never enters it: opening
 * starts a fresh history, and a rewrite is laid in as a patch outside history, so the typing
 * around it can still be undone (prosemirror-history maps it past the patch).
 */
import { createDocument, type Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { closeHistory, redoDepth, undoDepth } from "@tiptap/pm/history";

export interface LiveScene {
  editor: Editor;
  nodeId: string;
  title: string;
  /** Changes whenever the history is reset: steps from before it are dead. */
  session: number;
  /** Save what is typed but not yet saved, so the server's copy is current before it undoes. */
  flush: () => Promise<void>;
}

let live: LiveScene | null = null;
let sessions = 0;
/** True while the timeline itself is moving the editor's history. */
let replaying = false;
const listeners = new Set<() => void>();

export function liveScene(): LiveScene | null {
  return live;
}

export function setLiveScene(scene: Omit<LiveScene, "session"> | null): void {
  if (!scene) live = null;
  else live = { ...scene, session: live && live.editor === scene.editor ? live.session : ++sessions };
  notify();
}

/** Runs when the editor's history changes depth (the header's labels follow it). */
export function onSceneHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  listeners.forEach((l) => l());
}

export function isReplaying(): boolean {
  return replaying;
}

export function canUndoTyping(nodeId: string, session: number): boolean {
  return !!live && live.nodeId === nodeId && live.session === session && undoDepth(live.editor.state) > 0;
}

export function canRedoTyping(nodeId: string, session: number): boolean {
  return !!live && live.nodeId === nodeId && live.session === session && redoDepth(live.editor.state) > 0;
}

export function replayTyping(kind: "undo" | "redo"): boolean {
  if (!live) return false;
  replaying = true;
  try {
    return kind === "undo" ? live.editor.commands.undo() : live.editor.commands.redo();
  } finally {
    replaying = false;
  }
}

/** A server change just landed: the next keystroke starts a new step, after it. */
export function closeTyping(): void {
  if (!live || live.editor.isDestroyed) return;
  live.editor.view.dispatch(closeHistory(live.editor.state.tr));
}

/** Open a scene's text with a history of its own: ⌘Z never brings back the last scene's. */
export function loadScene(editor: Editor, html: string, { emitUpdate = false } = {}): void {
  editor.chain().setMeta("addToHistory", false).setContent(html, emitUpdate).run();
  const { state } = editor;
  editor.view.updateState(
    EditorState.create({ doc: state.doc, plugins: state.plugins, selection: state.selection }),
  );
  if (live && live.editor === editor) live = { ...live, session: ++sessions };
  notify();
}

/**
 * Lay the server's rewrite of this scene in, outside history: only the part that changed is
 * replaced, so the author's typing elsewhere in the scene keeps its place in ⌘Z. Does not
 * autosave; the server already holds this text.
 */
export function patchScene(editor: Editor, html: string): void {
  let next;
  try {
    next = createDocument(html, editor.schema);
  } catch {
    return loadScene(editor, html);
  }
  const doc = editor.state.doc;
  const start = doc.content.findDiffStart(next.content);
  if (start == null) return;
  const end = doc.content.findDiffEnd(next.content);
  if (!end) return;
  let { a, b } = end;
  const overlap = start - Math.min(a, b);
  if (overlap > 0) {
    a += overlap;
    b += overlap;
  }
  try {
    const tr = editor.state.tr
      .replace(start, a, next.slice(start, b))
      .setMeta("addToHistory", false)
      .setMeta("preventUpdate", true);
    editor.view.dispatch(tr);
  } catch {
    loadScene(editor, html);
  }
}
