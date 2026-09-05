import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { api } from "../../api/client";
import type { InlineNote, StructureNode } from "../../types";
import { setInlineNoteCallbacks } from "../story/InlineNoteExtension";

export type NotePopover =
  | { open: false }
  | { open: true; isNew: true; from: number; to: number; anchor: string; rect: DOMRect | null }
  | { open: true; isNew: false; noteId: string; rect: DOMRect | null; isEditing: boolean };

interface Args {
  editor: Editor | null;
  activeNode: StructureNode | null;
  setActiveNode: (node: StructureNode) => void;
  popoverRef: RefObject<HTMLDivElement | null>;
}

/** Inline notes: the anchored marks in the prose and the list in the overview panel. */
export function useInlineNotes({ editor, activeNode, setActiveNode, popoverRef }: Args) {
  // The node is the source of truth for notes; edits update it optimistically.
  const notes: InlineNote[] = activeNode?.metadata_?.inline_notes ?? [];
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
    (from: number, to: number, anchor: string) => {
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
      setPopover({ open: true, isNew: true, from, to, anchor, rect });
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

  async function persist(updated: InlineNote[]) {
    if (!activeNode) return;
    setActiveNode({ ...activeNode, metadata_: { ...activeNode.metadata_, inline_notes: updated } });
    try {
      // The server merges metadata_, so only inline_notes is sent.
      const patched = await api.updateNode(activeNode.id, { metadata_: { inline_notes: updated } });
      setActiveNode({ ...activeNode, metadata_: patched.metadata_ });
    } catch {
      /* the local list stands; the next save retries */
    }
  }

  async function save() {
    if (!activeNode || !editor || !popover.open || !popover.isNew) return;
    const { from, to, anchor } = popover;
    const newNote: InlineNote = { id: crypto.randomUUID(), anchor, note: inputText.trim(), position: from };
    editor.chain().setTextSelection({ from, to }).setMark("inlineNote", { noteId: newNote.id }).run();
    setPopover({ open: false });
    await persist([...notes, newNote]);
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
    if (!activeNode || !editor) return;
    const range = markRange(noteId);
    if (range) editor.chain().setTextSelection(range).unsetMark("inlineNote").run();
    setPopover({ open: false });
    await persist(notes.filter((n) => n.id !== noteId));
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
    await persist(notes.map((n) => (n.id === noteId ? { ...n, note: newText } : n)));
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

  function triggerAdd() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty) beginAdd(from, to, editor.state.doc.textBetween(from, to));
    else editor.commands.focus();
  }

  return {
    notes,
    hideEditorial,
    setHideEditorial,
    popover,
    setPopover,
    inputText,
    setInputText,
    editText,
    setEditText,
    save,
    remove,
    update,
    scrollTo,
    triggerAdd,
  };
}

export type InlineNotesState = ReturnType<typeof useInlineNotes>;
