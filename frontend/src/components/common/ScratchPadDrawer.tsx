import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { X, ClipboardCopy, PenLine, Send } from "lucide-react";
import { api } from "../../api/client";
import { freewriteApi } from "../../api/freewrite";
import { dayLabel } from "../../lib/freewrite/day";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { useScratchPadStore } from "../../stores/scratchPadStore";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import { useUIStore } from "../../stores/uiStore";
import type { Story } from "../../types";
import styles from "./ScratchPadDrawer.module.css";

const SAVE_AFTER_MS = 800;

/**
 * The scratch pad (doc 15 N4): one page for anything, belonging to no story and kept with
 * the account. Words that turn out to belong to a story are sent to its Freewrite page.
 */
export default function ScratchPadDrawer() {
  const { scratchPadOpen, closeScratchPad, toggleScratchPad } = useUIStore();
  const activeStory = useStoryStore((s) => s.activeStory);
  const { loaded, load, set, save } = useScratchPadStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [sending, setSending] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Anything at all, for any story or none…" }),
    ],
    onUpdate: ({ editor }) => {
      set(editor.getHTML());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () => void save().catch(() => toast.error("The scratch pad was not saved.")),
        SAVE_AFTER_MS,
      );
    },
  });

  // The page comes from the account the first time the drawer opens.
  useEffect(() => {
    if (!scratchPadOpen || !editor) return;
    const show = () => editor.commands.setContent(useScratchPadStore.getState().html, false);
    if (loaded) show();
    else load().then(show, () => toast.error("The scratch pad did not load."));
  }, [scratchPadOpen, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing saves straight away.
  useEffect(() => {
    if (scratchPadOpen || !timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    void save().catch(() => {});
  }, [scratchPadOpen, save]);

  // Scratch pad shortcut (see lib/keyboard/shortcuts.ts)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.scratchPad.combo)) {
        e.preventDefault();
        toggleScratchPad();
      }
      if (e.key === "Escape" && scratchPadOpen) {
        if (stories) setStories(null);
        else closeScratchPad();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scratchPadOpen, toggleScratchPad, closeScratchPad, stories]);

  /** The selected words, or the paragraph the cursor is in. */
  function words(): string {
    if (!editor) return "";
    const { from, to, empty, $from } = editor.state.selection;
    return (empty ? $from.parent.textContent : editor.state.doc.textBetween(from, to, "\n\n")).trim();
  }

  async function sendTo(story: Story) {
    const text = words();
    setStories(null);
    if (!text) return toast.info("Put the cursor in a paragraph, or select words, to send them.");
    setSending(true);
    try {
      await freewriteApi.append(story.id, text, dayLabel(new Date()));
      toast.success(`Sent to the Freewrite page of ${story.title}.`);
    } catch {
      toast.error("That was not sent.");
    } finally {
      setSending(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(editor?.getText() ?? "").catch(() => {});
  }

  if (!scratchPadOpen) return null;

  const ordered = stories
    ? [...stories].sort((a, b) => (a.id === activeStory?.id ? -1 : b.id === activeStory?.id ? 1 : 0))
    : [];
  return (
    <>
      <div className={styles.backdrop} onClick={closeScratchPad} />
      <div className={styles.drawer} role="dialog" aria-label="Scratch pad">
        <div className={styles.drawerHeader}>
          <div className={styles.titleRow}>
            <PenLine size={14} className={styles.titleIcon} />
            <span className={styles.title}>Scratch pad</span>
            <span className={styles.titleNote}>yours, not any story's</span>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={copyToClipboard}
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
            >
              <ClipboardCopy size={13} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={closeScratchPad}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className={styles.editorWrap}>
          <EditorContent editor={editor} className={styles.editor} />
        </div>

        <div className={styles.drawerFooter}>
          <div className={styles.sendWrap}>
            <button
              type="button"
              className={styles.sendBtn}
              disabled={sending}
              aria-haspopup="menu"
              aria-expanded={!!stories}
              onClick={() =>
                stories
                  ? setStories(null)
                  : api.listStories().then(setStories, () => toast.error("No stories to send to."))
              }
              title="Send the selected words, or the paragraph at the cursor, to a story's Freewrite page"
            >
              <Send size={12} aria-hidden /> Send to a story
            </button>
            {stories && (
              <div className={styles.sendMenu} role="menu" aria-label="Send to">
                <span className={styles.sendHint}>To the end of its Freewrite page</span>
                {ordered.map((s) => (
                  <button key={s.id} type="button" role="menuitem" onClick={() => void sendTo(s)}>
                    {s.title}
                    {s.id === activeStory?.id && <span className={styles.sendHere}>open</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={styles.hint}>
            {formatCombo(SHORTCUTS.scratchPad.combo)} to toggle · Esc to close
          </span>
        </div>
      </div>
    </>
  );
}
