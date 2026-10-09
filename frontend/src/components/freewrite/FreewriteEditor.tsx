import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { proseStarterKit } from "../editor/starterKit";
import { freewriteApi } from "../../api/freewrite";
import { dayLabel, lastDay, trimEmptyDay } from "../../lib/freewrite/day";
import { MadeMark } from "./MadeMark";
import MakeBar from "./MakeBar";
import styles from "./Freewrite.module.css";

const SAVE_AFTER_MS = 800;

/** Every ref the page's marks carry, in the order they appear. */
function refsIn(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    for (const m of node.marks)
      if (m.type.name === "made" && m.attrs.ref && !out.includes(m.attrs.ref)) out.push(m.attrs.ref);
  });
  return out;
}

/** Start today's section at the end of the page, unless the last one is already today's. */
function openToday(editor: Editor) {
  const today = dayLabel(new Date());
  if (lastDay(editor.getHTML()) === today) return editor.commands.focus("end");
  const empty = editor.isEmpty;
  const day = `<h3>${today}</h3><p></p>`;
  if (empty) editor.commands.setContent(day, { emitUpdate: false });
  else editor.chain().focus("end").insertContentAt(editor.state.doc.content.size, day).run();
  editor.commands.focus("end");
}

/**
 * The Freewrite page's writing surface (doc 15 N3), on its own page and in the side panel:
 * loose writing under a heading for each day, saved as you go. Select words to make them
 * into something; `onRefs` hears what the page has made so far.
 */
export default function FreewriteEditor({
  storyId,
  compact = false,
  onRefs,
}: {
  storyId: string;
  compact?: boolean;
  onRefs?: (refs: string[]) => void;
}) {
  const [state, setState] = useState<"loading" | "saved" | "saving" | "failed">("loading");
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefsRef = useRef(onRefs);
  useEffect(() => {
    onRefsRef.current = onRefs;
  });

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const html = pending.current;
    if (html === null) return;
    pending.current = null;
    setState("saving");
    try {
      await freewriteApi.put(storyId, trimEmptyDay(html));
      setState(pending.current === null ? "saved" : "saving");
    } catch {
      pending.current = pending.current ?? html;
      setState("failed");
    }
  }

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { "aria-label": "Freewrite" } },
    extensions: [
      proseStarterKit({ heading: { levels: [3] } }),
      Placeholder.configure({ placeholder: "Type whatever comes. Select a sentence to make it something." }),
      MadeMark,
    ],
    editable: false,
    onUpdate: ({ editor }) => {
      pending.current = editor.getHTML();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
      onRefsRef.current?.(refsIn(editor));
    },
  });

  useEffect(() => {
    if (!editor) return;
    let gone = false;
    freewriteApi
      .get(storyId)
      .then(({ html }) => {
        if (gone) return;
        editor.commands.setContent(html || "", { emitUpdate: false });
        editor.setEditable(true);
        onRefsRef.current?.(refsIn(editor));
        openToday(editor);
        setState("saved");
      })
      .catch(() => !gone && setState("failed"));
    return () => {
      gone = true;
      void flush();
    };
  }, [editor, storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.surface} data-compact={compact || undefined}>
      <EditorContent editor={editor} className={styles.prose} />
      {editor && state !== "loading" && <MakeBar editor={editor} storyId={storyId} />}
      <span className={styles.saveState} role="status">
        {state === "saving"
          ? "Saving…"
          : state === "failed"
            ? "Not saved; it will try again as you type"
            : ""}
      </span>
    </div>
  );
}
