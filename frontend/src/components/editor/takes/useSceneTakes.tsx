import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { api } from "../../../api/client";
import { ApiError } from "../../../api/request";
import { takesApi } from "../../../api/takes";
import { SCENES_REWRITTEN_EVENT } from "../../../lib/sceneEvents";
import { reloadStructure } from "../../../lib/story/loadStory";
import { UNDO_APPLIED_EVENT } from "../../../lib/undo/events";
import { loadScene, patchScene } from "../../../lib/undo/sceneHistory";
import { useEditorBridge } from "../../../stores/editorBridge";
import { takeName, useTakesStore } from "../../../stores/takesStore";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import type { TakesOut } from "../../../types/takes";
import NameDialog from "../../common/NameDialog";
import type { AutosaveState } from "../useSceneAutosave";

/** What the header's switcher, Compare, the ⋯ menu, the palette and This scene ask of the takes. */
export interface TakesBridge {
  tryAnother: () => void;
  switchTo: (takeId: string) => void;
  use: (takeId: string) => void;
  rename: (takeId: string) => void;
  remove: (takeId: string) => void;
  compare: (on: boolean) => void;
  /** Save what is typed, then read the takes again: for a copy of them shown elsewhere. */
  refresh: () => Promise<void>;
}

/**
 * The open scene's takes in its editor (doc 29 D7).
 *
 * - **What the editor shows** is the open take: the scene's prose when that is the take that
 *   counts (or the only one), else the take's own text, and autosave writes there
 *   (`useSceneAutosave`, `editingTake`).
 * - **History:** a switch lays the other take in with `loadScene`, which starts a fresh history
 *   and a new session on the undo timeline, so one take's typing is never undone into another.
 *   The switch itself is a server change ⌘Z takes back, and undoing it lays the first take in
 *   again, also fresh. Trying another version does the same: the copy starts with no history.
 * - **Undo, and rewrites from outside** (a replace, a rename): the takes are read again and the
 *   editor follows: another take laid in, or the shown one patched outside history.
 *
 * Everything saves first, so what was typed lands in the take it was typed in.
 */
export function useSceneTakes(editor: Editor | null, autosave: AutosaveState): ReactNode {
  const node = useStoryStore((s) => s.activeNode);
  const nodeId = node?.id;
  const needsProse = !!node && node.content === undefined;
  /** The take laid in the editor: an id for a take that does not count, null for the scene's prose. */
  const shown = useRef<{ nodeId: string; takeId: string | null } | null>(null);
  const [naming, setNaming] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const latestAutosave = useRef(autosave);
  useEffect(() => {
    latestAutosave.current = autosave;
  });

  /** Make the editor show the open take of `out`, reading the scene's prose when it is that. */
  async function follow(out: TakesOut, { patch = true } = {}) {
    if (!editor || editor.isDestroyed || useStoryStore.getState().activeNode?.id !== out.node_id) return;
    useTakesStore.getState().setTakes(out.node_id, out.takes);
    const open = out.takes.find((t) => t.is_open) ?? null;
    const want = open && !open.counts ? open : null;
    const html = want ? want.content : (open?.content ?? (await api.getNode(out.node_id)).content ?? "");
    if (editor.isDestroyed || useStoryStore.getState().activeNode?.id !== out.node_id) return;
    const was = shown.current;
    const save = latestAutosave.current;
    if (!was || was.nodeId !== out.node_id || was.takeId !== (want?.id ?? null)) {
      loadScene(editor, html, { nodeId: out.node_id });
      shown.current = { nodeId: out.node_id, takeId: want?.id ?? null };
      save.recount(editor);
      if (want) save.checkDraft(`take:${want.id}`, want.content, want.updated_at);
    } else if (
      patch &&
      !["unsaved", "saving", "conflict"].includes(save.saveState) &&
      editor.getHTML() !== html
    ) {
      patchScene(editor, html, out.node_id);
      save.recount(editor);
    }
    editor.setEditable(true, false);
  }

  // A scene opened: its takes, and the open one laid in once the prose is.
  useEffect(() => {
    if (!editor || !nodeId) return;
    const many = (useStoryStore.getState().activeNode?.take_count ?? 1) > 1;
    useTakesStore.getState().reset(nodeId);
    useTakesStore.getState().setComparing(false);
    // Nothing to type into until the open take is in, so no words land in the wrong one.
    if (many) editor.setEditable(false, false);
    if (needsProse) return;
    shown.current = { nodeId, takeId: null };
    let gone = false;
    takesApi
      .list(nodeId)
      .then((out) => {
        if (!gone) void follow(out);
      })
      .catch(() => {
        if (!gone) editor.setEditable(true, false);
      });
    return () => {
      gone = true;
    };
  }, [editor, nodeId, needsProse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Undo, redo and rewrites from outside: read the takes again and follow them.
  useEffect(() => {
    function again(e: Event) {
      const id = useStoryStore.getState().activeNode?.id;
      if (!id || !editor) return;
      const detail = (e as CustomEvent).detail as { entity_type?: string; nodeIds?: string[] } | undefined;
      const has = useTakesStore.getState().nodeId === id && useTakesStore.getState().takes.length > 0;
      if (!has && detail?.entity_type !== "scene_take" && !(detail?.nodeIds ?? []).includes(id)) return;
      if (!has && e.type === SCENES_REWRITTEN_EVENT) return; // the autosave lays a plain scene in
      takesApi
        .list(id)
        .then((out) => follow(out))
        .catch(() => {});
    }
    window.addEventListener(UNDO_APPLIED_EVENT, again);
    window.addEventListener(SCENES_REWRITTEN_EVENT, again);
    return () => {
      window.removeEventListener(UNDO_APPLIED_EVENT, again);
      window.removeEventListener(SCENES_REWRITTEN_EVENT, again);
    };
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Save, do it, follow the answer, and bring the scene's figures up to date. */
  async function act(job: () => Promise<TakesOut>, done?: (out: TakesOut) => void) {
    const id = useStoryStore.getState().activeNode?.id;
    if (!editor || !id || busy) return;
    setBusy(true);
    try {
      await latestAutosave.current.flush();
      const out = await job();
      await follow(out, { patch: false });
      const store = useStoryStore.getState();
      if (store.activeNode?.id === id) store.setActiveNode(await api.getNode(id));
      void reloadStructure();
      done?.(out);
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 400 ? e.message : "That didn't work. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  const named = (out: TakesOut, id: string) => {
    const t = out.takes.find((x) => x.id === id);
    return t ? takeName(t) : "This take";
  };

  const actions: TakesBridge = {
    tryAnother: () => {
      const id = useStoryStore.getState().activeNode?.id;
      if (!id) return;
      void act(
        () => takesApi.tryAnother(id),
        (out) => {
          const open = out.takes.find((t) => t.is_open);
          const counting = out.takes.find((t) => t.counts);
          if (open && counting)
            toast.info(
              `${takeName(open)} is open: a copy to change as you like. ${takeName(counting)} still counts.`,
            );
        },
      );
    },
    switchTo: (takeId) => void act(() => takesApi.open(takeId)),
    use: (takeId) =>
      void act(
        () => takesApi.use(takeId),
        (out) =>
          toast.info(
            `${named(out, takeId)} counts now: it is the scene in your manuscript, exports and checks.`,
          ),
      ),
    rename: (takeId) => {
      const t = useTakesStore.getState().takes.find((x) => x.id === takeId);
      if (t) setNaming({ id: t.id, label: t.label });
    },
    remove: (takeId) => void act(() => takesApi.remove(takeId)),
    compare: (on) => {
      if (!on) return useTakesStore.getState().setComparing(false);
      // Saved first and read again, so Compare shows the words as they stand.
      void refresh()
        .then(() => useTakesStore.getState().setComparing(useTakesStore.getState().takes.length > 1))
        .catch(() => toast.error("Compare did not open. Try again in a moment."));
    },
    refresh,
  };

  async function refresh() {
    const id = useStoryStore.getState().activeNode?.id;
    if (!id) return;
    await latestAutosave.current.flush();
    const out = await takesApi.list(id);
    if (useStoryStore.getState().activeNode?.id === id) useTakesStore.getState().setTakes(id, out.takes);
  }

  // The header, the ⋯ menu, the palette and This scene reach them through the bridge.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  const setBridge = useEditorBridge((s) => s.setTakes);
  useEffect(() => {
    if (!editor) return;
    setBridge({
      tryAnother: () => latest.current.tryAnother(),
      switchTo: (id) => latest.current.switchTo(id),
      use: (id) => latest.current.use(id),
      rename: (id) => latest.current.rename(id),
      remove: (id) => latest.current.remove(id),
      compare: (on) => latest.current.compare(on),
      refresh: () => latest.current.refresh(),
    });
    return () => setBridge(null);
  }, [editor, setBridge]);

  if (!naming) return null;
  const take = useTakesStore.getState().takes.find((t) => t.id === naming.id);
  return (
    <NameDialog
      title={`Rename ${take ? `Take ${take.number}` : "this take"}`}
      label="What to call it"
      initial={naming.label}
      confirm="Rename"
      busy={busy}
      onConfirm={(label) => {
        setNaming(null);
        void act(() => takesApi.rename(naming.id, label));
      }}
      onCancel={() => setNaming(null)}
    >
      A few words to tell it from the others, such as “first draft” or “Calder speaks first”.
    </NameDialog>
  );
}
