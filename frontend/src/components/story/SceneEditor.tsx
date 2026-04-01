import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { Maximize2, Minimize2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import styles from "./SceneEditor.module.css";

export default function SceneEditor() {
  const { activeNode, setActiveNode } = useStoryStore();
  const { focusMode, toggleFocusMode } = useUIStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Begin writing…" }),
      CharacterCount,
      Typography,
    ],
    content: activeNode?.content ?? "",
    onUpdate: ({ editor }) => {
      if (!activeNode) return;
      const content = editor.getHTML();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const wordCount = editor.storage.characterCount?.words() ?? 0;
        const updated = await api.updateNode(activeNode.id, { content, word_count: wordCount });
        setActiveNode({ ...activeNode, content, word_count: updated.word_count });
      }, 1200);
    },
  });

  useEffect(() => {
    if (!editor || !activeNode) return;
    const current = editor.getHTML();
    if (current !== activeNode.content) {
      editor.commands.setContent(activeNode.content ?? "");
    }
  }, [activeNode?.id]);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  if (!activeNode) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Select a section from the sidebar to begin writing.</p>
      </div>
    );
  }

  const statusClass =
    activeNode.status === "final"
      ? styles.final
      : activeNode.status === "revised"
      ? styles.revised
      : "";

  return (
    <div className={styles.container}>
      <div className={styles.topbar}>
        <div className={styles.titleGroup}>
          <span className={styles.nodeTitle}>{activeNode.title}</span>
          <span className={`${styles.statusBadge} ${statusClass}`}>
            {activeNode.status}
          </span>
        </div>
        <div className={styles.metaGroup}>
          <span className={styles.wordCount}>{wordCount.toLocaleString()} words</span>
          <button
            onClick={toggleFocusMode}
            className={styles.focusBtn}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
          >
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.editorWrap}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
