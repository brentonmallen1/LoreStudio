import { serverTime } from "../../lib/serverDate";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { api, ApiError } from "../../api/client";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import { useProposalsStore } from "../../stores/proposalsStore";
import { clearDraft, loadDraft, saveDraft, type Draft } from "../../lib/draftBuffer";
import { countWordsClean } from "./segmentMeta";
import { SCENES_REWRITTEN_EVENT } from "../../lib/sceneEvents";

export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "offline" | "conflict";

const SAVE_DEBOUNCE_MS = 1200;
const SAVED_FLASH_MS = 2000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

/**
 * Debounced content autosave, live word count, and the two ways a save can go
 * wrong: the server refusing because the scene changed elsewhere (409 conflict),
 * and the network being unreachable (offline, retried with backoff). Every
 * keystroke also lands in the local draft buffer so a crashed tab loses nothing.
 */
export function useSceneAutosave(editor: Editor | null) {
  const { activeNode, activeStory, setActiveNode } = useStoryStore();
  const discoverIn = useProposalsStore((s) => s.discoverIn);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState<StructureNode | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const lastContentRef = useRef<{ nodeId: string; content: string } | null>(null);

  // Word count: seeded from the stored value, kept live by handleUpdate.
  const [countedNodeId, setCountedNodeId] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const wordCount = activeNode && countedNodeId === activeNode.id ? liveCount : (activeNode?.word_count ?? 0);

  // On entering a node, look for a draft newer than what the server has.
  useEffect(() => {
    if (!activeNode) return;
    const nodeId = activeNode.id;
    const serverContent = activeNode.content ?? "";
    // Compared as instants: read as local time, the server copy looked hours newer than
    // any draft west of Greenwich, and the draft was cleared instead of offered.
    const serverSavedAt = serverTime(activeNode.updated_at);
    let cancelled = false;
    loadDraft(nodeId).then((draft) => {
      if (cancelled) return;
      if (draft && draft.content !== serverContent && draft.savedAt > serverSavedAt) setPendingDraft(draft);
      else if (draft) clearDraft(nodeId);
    });
    return () => {
      cancelled = true;
    };
  }, [activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A scene rewritten from outside the editor (quote conversion, replace, undo). With
  // nothing unsaved here, load the new text. With unsaved typing, leave both alone: its
  // save meets the server's newer copy and asks Keep mine / Take theirs, so neither the
  // typing nor the rewrite is dropped without the author choosing.
  useEffect(() => {
    function onRewritten(event: Event) {
      const { nodeIds } = (event as CustomEvent<{ nodeIds: string[] }>).detail;
      const node = useStoryStore.getState().activeNode;
      if (!editor || !node || !nodeIds.includes(node.id)) return;
      if (
        saveState === "unsaved" ||
        saveState === "saving" ||
        saveState === "offline" ||
        saveState === "conflict"
      )
        return;
      api.getNode(node.id).then((fresh) => {
        if (useStoryStore.getState().activeNode?.id !== fresh.id) return;
        setActiveNode(fresh);
        editor.commands.setContent(fresh.content ?? "", false);
        clearDraft(fresh.id);
      });
    }
    window.addEventListener(SCENES_REWRITTEN_EVENT, onRewritten);
    return () => window.removeEventListener(SCENES_REWRITTEN_EVENT, onRewritten);
  }, [editor, saveState, setActiveNode]);

  /** Stored HTML as text, for counting a draft the editor is not showing. */
  function htmlText(html: string): string {
    const doc = new DOMParser().parseFromString(
      html.replace(/<\/(p|h[1-6]|li|blockquote|div)>|<br\s*\/?>/gi, "$&\n"),
      "text/html",
    );
    return doc.body.textContent ?? "";
  }

  async function persist(nodeId: string, content: string, force: boolean) {
    const node = useStoryStore.getState().activeNode;
    if (!node || node.id !== nodeId) return;
    setSaveState("saving");
    const count = countWordsClean(
      editor && editor.getHTML() === content ? editor.getText() : htmlText(content),
    );
    try {
      const updated = await api.updateNode(nodeId, {
        content,
        word_count: count,
        ...(force ? {} : { expected_updated_at: node.updated_at }),
      });
      const current = useStoryStore.getState().activeNode;
      if (current && current.id === nodeId) {
        setActiveNode({
          ...current,
          content,
          word_count: updated.word_count,
          updated_at: updated.updated_at,
        });
      }
      await clearDraft(nodeId);
      retryCountRef.current = 0;
      setConflict(null);
      setSaveState("saved");
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveState("idle"), SAVED_FLASH_MS);
      if (activeStory?.discovery_enabled && activeStory?.discovery_auto_analyze) {
        discoverIn(node.story_id, nodeId).catch(() => {});
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict((err.detail as { node: StructureNode }).node);
        setSaveState("conflict");
        return;
      }
      // Network or server trouble: keep the draft, retry with backoff.
      setSaveState("offline");
      const delay = RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
      retryCountRef.current += 1;
      saveTimeoutRef.current = setTimeout(() => persist(nodeId, content, force), delay);
    }
  }

  function handleUpdate(ed: Editor) {
    const node = useStoryStore.getState().activeNode;
    if (!node) return;
    const content = ed.getHTML();
    lastContentRef.current = { nodeId: node.id, content };
    setLiveCount(countWordsClean(ed.getText()));
    setCountedNodeId(node.id);
    setSaveState("unsaved");
    saveDraft(node.id, content);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    retryCountRef.current = 0;
    saveTimeoutRef.current = setTimeout(() => persist(node.id, content, false), SAVE_DEBOUNCE_MS);
  }

  /** Conflict: overwrite the server with what is in the editor. */
  function keepMine() {
    const last = lastContentRef.current;
    if (!last) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    persist(last.nodeId, last.content, true);
  }

  /** Conflict: adopt the server's version and drop local edits. */
  function takeTheirs() {
    if (!conflict) return;
    setActiveNode(conflict);
    if (editor) editor.commands.setContent(conflict.content ?? "", false);
    clearDraft(conflict.id);
    setConflict(null);
    setSaveState("idle");
  }

  /** Unsaved draft found for this node: load it into the editor (it saves normally afterwards). */
  function restoreDraft() {
    if (!pendingDraft || !editor) return;
    editor.commands.setContent(pendingDraft.content, true);
    setPendingDraft(null);
  }

  function discardDraft() {
    if (pendingDraft) clearDraft(pendingDraft.nodeId);
    setPendingDraft(null);
  }

  return {
    saveState,
    wordCount,
    handleUpdate,
    conflict,
    keepMine,
    takeTheirs,
    pendingDraft,
    restoreDraft,
    discardDraft,
  };
}

export type AutosaveState = ReturnType<typeof useSceneAutosave>;
