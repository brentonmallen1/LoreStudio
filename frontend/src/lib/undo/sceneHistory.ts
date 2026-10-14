/**
 * The open scene's editor, as one of the two histories ⌘Z reaches (doc 23 P5b).
 *
 * Its own history (prosemirror-history) holds the author's typing and nothing else. Text that
 * arrives from outside, opening a scene or a rewrite on the server, never enters it: opening
 * starts a fresh history, and a rewrite is laid in as a patch outside history, so the typing
 * around it can still be undone (prosemirror-history maps it past the patch). A cut on the
 * server (a split, doc 25) keeps the editor as it stood: undoing the cut brings that back,
 * typing and all.
 */
import { createDocument, getHTMLFromFragment, type Editor } from "@tiptap/core";
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
/** The scene as it stood before a cut on the server took text out of it. */
let beforeCut: { nodeId: string; state: EditorState; session: number } | null = null;
/** An editor given back its history before it became the live scene: its session goes on. */
let resumed: { editor: Editor; session: number } | null = null;
const listeners = new Set<() => void>();

export function liveScene(): LiveScene | null {
  return live;
}

export function setLiveScene(scene: Omit<LiveScene, "session"> | null): void {
  if (!scene) live = null;
  else {
    const session =
      live && live.editor === scene.editor
        ? live.session
        : resumed?.editor === scene.editor
          ? resumed.session
          : ++sessions;
    live = { ...scene, session };
  }
  resumed = null;
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

/**
 * A cut on the server is about to take text out of this scene (a split): keep the editor as
 * it stands, its cursor and its typing, for when ⌘Z puts the text back.
 */
export function keepBeforeCut(editor: Editor, nodeId: string): void {
  beforeCut = live && live.editor === editor ? { nodeId, state: editor.state, session: live.session } : null;
}

/**
 * The scene's text is back as it was before the cut: the editor as it stood then, so ⌘Z goes
 * on into the typing from before it, and the cursor is where it was. False for any other text.
 */
function restoreBeforeCut(editor: Editor, nodeId: string | undefined, html: string): boolean {
  const kept = beforeCut;
  if (!kept || kept.nodeId !== nodeId || editor.isDestroyed) return false;
  try {
    // Both through HTML: the editor's own nodes can carry attributes the stored text drops.
    const was = getHTMLFromFragment(kept.state.doc.content, editor.schema);
    if (!createDocument(html, editor.schema).eq(createDocument(was, editor.schema))) return false;
  } catch {
    return false;
  }
  beforeCut = null;
  // Not typing: the timeline already holds these steps. Opening the scene can build a new
  // editor; its plugins take the state over, and the history's field, keyed the same in
  // every editor, comes with it.
  replaying = true;
  try {
    editor.view.updateState(kept.state.reconfigure({ plugins: editor.state.plugins }));
  } finally {
    replaying = false;
  }
  if (live && live.editor === editor) live = { ...live, session: kept.session };
  else resumed = { editor, session: kept.session };
  notify();
  return true;
}

/**
 * Open a scene's text with a history of its own: ⌘Z never brings back the last scene's. The
 * one exception is `nodeId`'s text coming back as it was before a cut (`keepBeforeCut`).
 */
export function loadScene(
  editor: Editor,
  html: string,
  { emitUpdate = false, nodeId }: { emitUpdate?: boolean; nodeId?: string } = {},
): void {
  // React can run the loading effect on an editor TipTap has already destroyed: a Suspense
  // boundary that hid the page (the side panel lazy-loading on its This scene tab) tears the
  // editor down, then reconnects the effect with the old instance. Its view is gone, so this
  // threw and took the whole app with it. The new editor's own effect loads the scene.
  if (editor.isDestroyed || restoreBeforeCut(editor, nodeId, html)) return;
  editor.chain().setMeta("addToHistory", false).setContent(html, { emitUpdate }).run();
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
 * autosave; the server already holds this text. `nodeId`'s text as it was before a cut brings
 * back the editor as it stood then.
 */
export function patchScene(editor: Editor, html: string, nodeId?: string): void {
  if (editor.isDestroyed || restoreBeforeCut(editor, nodeId, html)) return;
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
