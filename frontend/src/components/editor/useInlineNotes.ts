import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { useSearchParams } from "react-router-dom";
import { notesApi } from "../../api/notes";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { findTextRange } from "../../lib/notes/anchor";
import { sentenceAround } from "../../lib/notes/sentence";
import { toast } from "../../stores/toastStore";
import { KIND_LABEL } from "../notes/kinds";
import type { InlineNote, StructureNode } from "../../types";
import type { Note, NoteKind, NoteUpdate } from "../../types/notes";
import { setInlineNoteCallbacks } from "../story/InlineNoteExtension";

export type NotePopover =
  | { open: false }
  | {
      open: true;
      isNew: true;
      kind: NoteKind;
      from: number;
      to: number;
      anchor: string;
      rect: DOMRect | null;
    }
  | { open: true; isNew: false; noteId: string; rect: DOMRect | null; isEditing: boolean };

interface Args {
  editor: Editor | null;
  activeNode: StructureNode | null;
  setActiveNode: (node: StructureNode) => void;
  popoverRef: RefObject<HTMLDivElement | null>;
}

/** A note row as the margin draws it. */
function toInline(n: Note): InlineNote {
  const editorial = n.source?.startsWith("editorial-");
  return {
    id: n.id,
    kind: n.kind,
    anchor: n.anchor ?? "",
    note: n.content,
    answer: n.answer,
    done: n.done,
    position: n.position,
    type: editorial ? "editorial" : "author",
    category: n.category ?? undefined,
    source: n.source ?? undefined,
  };
}

/** The document positions of the sentence the cursor is in (`/todo` with nothing selected). */
function sentenceAtCursor(editor: Editor): { from: number; to: number } | null {
  const { $from } = editor.state.selection;
  const block = $from.parent;
  if (!block.isTextblock || !block.textContent.trim()) return null;
  const [s, e] = sentenceAround(block.textContent, $from.parentOffset);
  // Character offsets to positions: walk the block's text, so a mention or an image inside
  // it does not shift the range.
  let seen = 0;
  let from: number | null = null;
  let to: number | null = null;
  block.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const start = $from.start() + pos;
    if (from === null && s < seen + node.text.length) from = start + (s - seen);
    if (to === null && e <= seen + node.text.length) to = start + (e - seen);
    seen += node.text.length;
  });
  return from !== null && to !== null && from < to ? { from, to } : null;
}

/**
 * The scene's notes (doc 15): every kind tied to the scene, and the ones tied to a passage,
 * whose mark in the prose carries the note's id. Edits show at once; the server's answer
 * replaces them.
 */
export function useInlineNotes({ editor, activeNode, popoverRef }: Args) {
  const nodeId = activeNode?.id;
  const storyId = activeNode?.story_id;
  const [loaded, setLoaded] = useState<{ nodeId: string | undefined; rows: Note[] }>({
    nodeId: undefined,
    rows: [],
  });
  const rows = useMemo(() => (loaded.nodeId === nodeId ? loaded.rows : []), [loaded, nodeId]);
  // The margin's notes: those tied to a passage. The scene's list shows them all.
  // Resolved notes leave the margin (like resolved comments) unless asked for (doc 15 polish).
  const [showResolved, setShowResolved] = useState(false);
  const notes: InlineNote[] = useMemo(
    () => rows.filter((n) => n.anchor && (showResolved || !n.done)).map(toInline),
    [rows, showResolved],
  );
  const load = useCallback(() => {
    if (!nodeId || !storyId) return;
    return notesApi.list(storyId, { node_id: nodeId }).then((list) => setLoaded({ nodeId, rows: list }));
  }, [nodeId, storyId]);
  useEffect(() => {
    load()?.catch(() => {});
  }, [load]);
  useReloadOnUndo(["note"], load);
  const setRows = (next: Note[]) => setLoaded({ nodeId, rows: next });
  const [hideEditorial, setHideEditorial] = useState(false);
  // A popover belongs to the node it was opened on; switching nodes closes it.
  const [popoverState, setPopoverState] = useState<{ nodeId: string | undefined; value: NotePopover }>({
    nodeId: undefined,
    value: { open: false },
  });
  const popover: NotePopover = useMemo(
    () => (popoverState.nodeId === activeNode?.id ? popoverState.value : { open: false }),
    [popoverState, activeNode?.id],
  );
  const setPopover = useCallback(
    (value: NotePopover) => setPopoverState({ nodeId: activeNode?.id, value }),
    [activeNode?.id],
  );
  const [inputText, setInputText] = useState("");
  const [editText, setEditText] = useState("");

  const activate = useCallback(
    (noteId: string, rect: DOMRect) =>
      setPopover({ open: true, isNew: false, noteId, rect, isEditing: false }),
    [setPopover],
  );

  const beginAdd = useCallback(
    (from: number, to: number, anchor: string, kind: NoteKind = "note") => {
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
      setPopover({ open: true, isNew: true, kind, from, to, anchor, rect });
      setInputText("");
    },
    [setPopover],
  );

  useEffect(() => {
    setInlineNoteCallbacks({ onNoteActivate: activate, onAddNote: beginAdd });
  }, [activate, beginAdd]);

  // Close a read-only popover on outside click (not while creating/editing)
  useEffect(() => {
    if (!popover.open || popover.isNew || popover.isEditing) return;
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover({ open: false });
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [popover, popoverRef, setPopover]);

  async function save() {
    if (!activeNode || !storyId || !editor || !popover.open || !popover.isNew) return;
    const { from, to, anchor, kind } = popover;
    const id = crypto.randomUUID();
    editor.chain().setTextSelection({ from, to }).setMark("inlineNote", { noteId: id }).run();
    setPopover({ open: false });
    try {
      const made = await notesApi.create(storyId, {
        id,
        kind,
        content: inputText.trim(),
        node_id: activeNode.id,
        anchor,
      });
      setRows([...rows, made]);
    } catch {
      /* the mark stays; the next load shows whether the note was kept */
    }
  }

  /** A note on the scene as a whole, from its tab in the side panel: no passage, no mark. */
  async function addToScene(kind: NoteKind, content: string) {
    if (!activeNode || !storyId || !content.trim()) return;
    const made = await notesApi.create(storyId, { kind, content: content.trim(), node_id: activeNode.id });
    setRows([...rows, made]);
  }

  function markRange(noteId: string): { from: number; to: number } | null {
    if (!editor) return null;
    let from: number | null = null;
    let to: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      if (node.marks.some((m) => m.type.name === "inlineNote" && m.attrs.noteId === noteId)) {
        if (from === null) from = pos;
        to = pos + node.nodeSize;
      }
    });
    return from !== null && to !== null ? { from, to } : null;
  }

  async function remove(noteId: string) {
    if (!activeNode) return;
    const gone = rows.find((n) => n.id === noteId);
    const range = editor ? markRange(noteId) : null;
    if (editor && range) editor.chain().setTextSelection(range).unsetMark("inlineNote").run();
    setPopover({ open: false });
    setRows(rows.filter((n) => n.id !== noteId));
    try {
      await notesApi.remove(noteId);
    } catch {
      void load();
      return;
    }
    // Undo brings the row back; the effect below marks its words again.
    if (gone)
      toast.undoable(`${KIND_LABEL[gone.kind]} deleted.`, () =>
        notesApi.restore(gone).then(
          () => load(),
          () => toast.error("It could not be brought back."),
        ),
      );
  }

  /** Any change to a note: its text, its kind, an answer, a tick. */
  async function change(noteId: string, data: NoteUpdate) {
    setRows(rows.map((n) => (n.id === noteId ? { ...n, ...data } : n)));
    await notesApi.update(noteId, data).catch(() => load());
  }

  async function update(noteId: string, newText: string) {
    if (!activeNode) return;
    setPopover({
      open: true,
      isNew: false,
      noteId,
      rect: popover.open ? popover.rect : null,
      isEditing: false,
    });
    await change(noteId, { content: newText });
  }

  function scrollTo(noteId: string) {
    if (!editor) return;
    const range = markRange(noteId);
    if (!range) return;
    editor.chain().focus().setTextSelection(range.from).scrollIntoView().run();
    setTimeout(() => {
      const el = document.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement | null;
      if (el)
        setPopover({ open: true, isNew: false, noteId, rect: el.getBoundingClientRect(), isEditing: false });
    }, 60);
  }

  /** Add a note of a kind on the selection; with nothing selected, on the sentence at the cursor. */
  function triggerAdd(kind: NoteKind = "note") {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const range = empty ? sentenceAtCursor(editor) : { from, to };
    if (!range) return void editor.commands.focus();
    if (empty) editor.commands.setTextSelection(range);
    beginAdd(range.from, range.to, editor.state.doc.textBetween(range.from, range.to), kind);
  }

  // A note whose words lost their mark (an undone delete, a paste, an older scene) is marked
  // again where its quoted words still read the same; where they don't, it is "lost" and
  // the scene's list says so. Editorial notes never marked the prose, so they are left be.
  const [lost, setLost] = useState<{ nodeId: string | undefined; ids: string[] }>({
    nodeId: undefined,
    ids: [],
  });
  useEffect(() => {
    if (!editor || loaded.nodeId !== nodeId || !nodeId) return;
    const marked = new Set<string>();
    editor.state.doc.descendants((node) => {
      for (const m of node.marks) if (m.type.name === "inlineNote") marked.add(m.attrs.noteId);
    });
    const markType = editor.schema.marks.inlineNote;
    const tr = editor.state.tr;
    const missing: string[] = [];
    for (const n of rows) {
      if (!n.anchor || n.done || n.source || marked.has(n.id)) continue;
      const range = findTextRange(tr.doc, n.anchor);
      if (range) tr.addMark(range.from, range.to, markType.create({ noteId: n.id }));
      else missing.push(n.id);
    }
    if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
    setLost({ nodeId, ids: missing });
  }, [editor, rows, loaded.nodeId, nodeId]);
  const lostIds = lost.nodeId === nodeId ? lost.ids : [];

  // Arriving from the Notes page with ?note=: show that note beside its words, once.
  const [params, setParams] = useSearchParams();
  const wanted = params.get("note");
  useEffect(() => {
    if (!wanted || !editor || !rows.some((r) => r.id === wanted)) return;
    scrollTo(wanted);
    setParams(
      (p) => {
        p.delete("note");
        return p;
      },
      { replace: true },
    );
  }, [wanted, editor, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // The shortcut reaches the latest triggerAdd (it closes over this render's rows).
  useEffect(() => setInlineNoteCallbacks({ onShortcut: () => triggerAdd("note") }));

  return {
    notes,
    sceneNotes: rows,
    /** Notes whose quoted words are no longer in the scene. */
    lostIds,
    showResolved,
    setShowResolved,
    hideEditorial,
    setHideEditorial,
    popover,
    setPopover,
    inputText,
    setInputText,
    editText,
    setEditText,
    save,
    addToScene,
    remove,
    change,
    update,
    scrollTo,
    triggerAdd,
  };
}

export type InlineNotesState = ReturnType<typeof useInlineNotes>;
