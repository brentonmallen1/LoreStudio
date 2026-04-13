import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { X, ClipboardCopy, PenLine } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./ScratchPadDrawer.module.css";

function storageKey(storyId: string | null, tab: "story" | "global") {
  if (tab === "global" || !storyId) return "ls_scratchpad_global";
  return `ls_scratchpad_${storyId}`;
}

function hasContent(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function hasScratchPadContent(storyId: string | null): boolean {
  const storyKey = storyId ? `ls_scratchpad_${storyId}` : null;
  const globalKey = "ls_scratchpad_global";
  const storyVal = storyKey ? localStorage.getItem(storyKey) ?? "" : "";
  const globalVal = localStorage.getItem(globalKey) ?? "";
  return hasContent(storyVal) || hasContent(globalVal);
}

export default function ScratchPadDrawer() {
  const { scratchPadOpen, closeScratchPad, toggleScratchPad } = useUIStore();
  const { activeStory } = useStoryStore();
  const storyId = activeStory?.id ?? null;
  const [tab, setTab] = useState<"story" | "global">("story");
  const [hasStoryContent, setHasStoryContent] = useState(false);
  const [hasGlobalContent, setHasGlobalContent] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentKey = storageKey(storyId, storyId ? tab : "global");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Capture a thought, idea, or note…" }),
    ],
    content: localStorage.getItem(currentKey) ?? "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => {
        localStorage.setItem(currentKey, html);
        setHasStoryContent(hasContent(localStorage.getItem(storageKey(storyId, "story")) ?? ""));
        setHasGlobalContent(hasContent(localStorage.getItem(storageKey(null, "global")) ?? ""));
      }, 800);
    },
  });

  // Load correct content when tab or storyId changes
  useEffect(() => {
    if (!editor) return;
    const saved = localStorage.getItem(currentKey) ?? "";
    editor.commands.setContent(saved);
  }, [currentKey]);

  // Refresh indicators on open
  useEffect(() => {
    if (!scratchPadOpen) return;
    setHasStoryContent(hasContent(localStorage.getItem(storageKey(storyId, "story")) ?? ""));
    setHasGlobalContent(hasContent(localStorage.getItem(storageKey(null, "global")) ?? ""));
    // Default to story tab when in a story, global otherwise
    setTab(storyId ? "story" : "global");
  }, [scratchPadOpen, storyId]);

  // ⌘⇧N global shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "n") {
        e.preventDefault();
        toggleScratchPad();
      }
      if (e.key === "Escape" && scratchPadOpen) {
        closeScratchPad();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scratchPadOpen, toggleScratchPad, closeScratchPad]);

  function copyToClipboard() {
    const text = editor?.getText() ?? "";
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (!scratchPadOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={closeScratchPad} />
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div className={styles.titleRow}>
            <PenLine size={14} className={styles.titleIcon} />
            <span className={styles.title}>Scratch Pad</span>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={copyToClipboard}
              title="Copy to clipboard"
            >
              <ClipboardCopy size={13} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={closeScratchPad}
              title="Close (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {storyId && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "story" ? styles.tabActive : ""}`}
              onClick={() => setTab("story")}
            >
              This Story
              {hasStoryContent && tab !== "story" && <span className={styles.dot} />}
            </button>
            <button
              className={`${styles.tab} ${tab === "global" ? styles.tabActive : ""}`}
              onClick={() => setTab("global")}
            >
              Global
              {hasGlobalContent && tab !== "global" && <span className={styles.dot} />}
            </button>
          </div>
        )}

        <div className={styles.editorWrap}>
          <EditorContent editor={editor} className={styles.editor} />
        </div>

        <div className={styles.drawerFooter}>
          <span className={styles.hint}>⌘⇧N to toggle · Esc to close</span>
        </div>
      </div>
    </>
  );
}
