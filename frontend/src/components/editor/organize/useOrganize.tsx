import { useEffect, useRef, useState, type ReactNode } from "react";
import { getHTMLFromFragment, type Editor } from "@tiptap/core";
import { api } from "../../../api/client";
import { organizeApi } from "../../../api/organize";
import { ApiError } from "../../../api/request";
import { navigateTo } from "../../../lib/navigation";
import { reloadStructure } from "../../../lib/story/loadStory";
import { keepBeforeCut, loadScene } from "../../../lib/undo/sceneHistory";
import { useEditorBridge } from "../../../stores/editorBridge";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import NameDialog from "../../common/NameDialog";

/** What the editor tells the writer when the server says no. */
function failed(e: unknown, what: string) {
  if (e instanceof ApiError && e.status === 409)
    toast.error("This scene changed somewhere else. Save it, then try again.");
  else if (e instanceof ApiError && e.status === 400) toast.error(e.message);
  else toast.error(`${what} Try again in a moment.`);
}

/**
 * Split and join for a prose scene (doc 29 D6), from the scene's ⋯, `/split` and the palette.
 *
 * - **Split the scene here:** the words after the cursor become a new scene after this one in
 *   the same chapter, named in a prompt ("<title> (continued)" to start with).
 * - **Join with the next scene:** the next scene's words come after this one's, at a scene break.
 *
 * Each saves first, then the server makes the change as one step ⌘Z takes back whole. The scene
 * reloads through `loadScene` after `keepBeforeCut`, so undoing it brings the editor back as it
 * stood, typing and all (frontend CLAUDE.md, undo).
 */
export function useOrganize(editor: Editor | null, flush: () => Promise<void>, enabled: boolean): ReactNode {
  const [asking, setAsking] = useState<{ pos: number; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function askSplit() {
    const node = useStoryStore.getState().activeNode;
    if (!editor || !node) return;
    const pos = editor.state.selection.from;
    const { doc } = editor.state;
    const rest = doc.textBetween(pos, doc.content.size, " ").trim();
    const kept = doc.textBetween(0, pos, " ").trim();
    if (!rest || !kept) {
      toast.info("Put the cursor where the new scene should start, with words before it and after it.");
      return;
    }
    setAsking({ pos, title: `${node.title || "Untitled"} (continued)` });
  }

  async function split(title: string) {
    const node = useStoryStore.getState().activeNode;
    const story = useStoryStore.getState().activeStory;
    if (!editor || !node || !asking || !story) return;
    const { doc, schema } = editor.state;
    const before = getHTMLFromFragment(doc.content.cut(0, asking.pos), schema);
    const after = getHTMLFromFragment(doc.content.cut(asking.pos), schema);
    setBusy(true);
    try {
      await flush();
      const made = await organizeApi.split(node.id, {
        content: before,
        new_content: after,
        title,
        expected_updated_at: useStoryStore.getState().activeNode?.updated_at,
      });
      keepBeforeCut(editor, node.id);
      loadScene(editor, before);
      const store = useStoryStore.getState();
      if (store.activeNode?.id === node.id) store.setActiveNode(await api.getNode(node.id));
      await reloadStructure();
      setAsking(null);
      toast.withAction(`“${made.title}” starts where the cursor was.`, "Open it", () =>
        navigateTo(`/stories/${story.id}/write/${made.id}`),
      );
    } catch (e) {
      failed(e, "The scene was not split.");
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    const node = useStoryStore.getState().activeNode;
    if (!editor || !node) return;
    setBusy(true);
    try {
      await flush();
      const joined = await organizeApi.mergeNext(node.id, useStoryStore.getState().activeNode?.updated_at);
      keepBeforeCut(editor, node.id);
      loadScene(editor, joined.content ?? "");
      const store = useStoryStore.getState();
      if (store.activeNode?.id === node.id) store.setActiveNode(joined);
      await reloadStructure();
      toast.info("The next scene's words follow this one's now, after a scene break.");
    } catch (e) {
      failed(e, "The scenes were not joined.");
    } finally {
      setBusy(false);
    }
  }

  // The ⋯ menu, `/split` and the palette reach these through the bridge, while a prose scene is open.
  const latest = useRef({ askSplit, merge });
  useEffect(() => {
    latest.current = { askSplit, merge };
  });
  const setOrganize = useEditorBridge((s) => s.setOrganize);
  useEffect(() => {
    setOrganize(
      enabled && editor
        ? { split: () => latest.current.askSplit(), merge: () => void latest.current.merge() }
        : null,
    );
    return () => setOrganize(null);
  }, [enabled, editor, setOrganize]);

  if (!asking) return null;
  return (
    <NameDialog
      title="Split the scene here"
      label="The new scene's title"
      initial={asking.title}
      confirm="Split it"
      busy={busy}
      onConfirm={(title) => void split(title)}
      onCancel={() => setAsking(null)}
    >
      The words after the cursor become a new scene, right after this one in the same chapter. Undo puts them
      back together.
    </NameDialog>
  );
}
