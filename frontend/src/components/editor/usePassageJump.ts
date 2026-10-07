import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { findPassage } from "../../lib/prose/findPassage";
import { useEditorBridge } from "../../stores/editorBridge";
import { toast } from "../../stores/toastStore";
import { flashPassages } from "../story/PassageFlashExtension";

/** How long the words stay lit; the CSS fade ends with it. */
const FLASH_MS = 3500;
/** A request older than this was for a scene that did not open: let it go. */
const LAPSE_MS = 15000;

/**
 * Shows the words a finding rests on: scrolls the first to the middle of the page, puts the
 * cursor there and lights every one of them for a moment. Waits for the scene's prose, which
 * arrives after the editor mounts when the scene came from the tree. Call it after the effect
 * that loads the prose, so the words are there to find.
 */
export function usePassageJump(editor: Editor | null, nodeId: string | undefined, proseLoaded: boolean) {
  const pending = useEditorBridge((s) => s.pendingPassage);
  const showPassage = useEditorBridge((s) => s.showPassage);
  // Outlives the effect: taking the request clears it, which runs the effect again.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!editor || !pending || !proseLoaded || pending.nodeId !== nodeId) return;
    showPassage(null);
    if (Date.now() - (pending.at ?? 0) > LAPSE_MS) return;
    const ranges = pending.passages
      .map((p) => findPassage(editor.state.doc, p))
      .filter((r): r is { from: number; to: number } => r !== null);
    if (!ranges.length) {
      toast.info("Those words have changed since the check ran");
      return;
    }
    editor.chain().focus().setTextSelection(ranges[0].from).run();
    flashPassages(editor, ranges);
    const at = editor.view.domAtPos(ranges[0].from).node;
    const el = at instanceof Element ? at : at.parentElement;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => !editor.isDestroyed && flashPassages(editor, []), FLASH_MS);
  }, [editor, pending, nodeId, proseLoaded, showPassage]);
}
