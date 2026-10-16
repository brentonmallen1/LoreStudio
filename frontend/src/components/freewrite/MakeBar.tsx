import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { ChevronDown } from "lucide-react";
import { notesApi } from "../../api/notes";
import { toast } from "../../stores/toastStore";
import type { NoteKind } from "../../types/notes";
import { KIND_LABEL } from "../notes/kinds";
import { makeFrom, type FileChoice } from "./makeFrom";
import { markMade } from "./MadeMark";
import SceneChooser, { type SceneChoice } from "./SceneChooser";
import styles from "./Freewrite.module.css";

type Thing = "character" | "place" | "theme" | "logline" | "premise" | "conflict";
const NOTE_KINDS: NoteKind[] = ["note", "question", "todo", "idea"];
const MORE: { kind: Thing; label: string }[] = [
  { kind: "theme", label: "A theme" },
  { kind: "logline", label: "The logline" },
  { kind: "premise", label: "Part of the premise" },
  { kind: "conflict", label: "Part of the central conflict" },
];

/** The scene chooser's height with every field showing, to place it where it fits. */
const CHOOSER_HEIGHT = 470;

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean);

/**
 * Make selected words into part of the story (doc 15 N3): a note of any kind, a character,
 * a place, a scene, or (under More) a theme, the logline. The words stay on the page with a
 * dotted mark that links to what they became. A long selection asks for a name first. A scene
 * asks which (doc 29 D9): planned, started, or an idea for the Outline, and shows where it lands.
 */
export default function MakeBar({ editor, storyId }: { editor: Editor; storyId: string }) {
  const [sel, setSel] = useState<{
    from: number;
    to: number;
    text: string;
    /** The words with their line breaks, for a scene's first draft. */
    lines: string;
    top: number;
    bottom: number;
    left: number;
  } | null>(null);
  const [asking, setAsking] = useState<{ kind: Thing; value: string } | null>(null);
  const [more, setMore] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function update() {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSel(null);
        setAsking(null);
        setMore(false);
        setChoosing(false);
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      setSel({
        from,
        to,
        text: editor.state.doc.textBetween(from, to, " "),
        lines: editor.state.doc.textBetween(from, to, "\n"),
        top: Math.min(start.top, end.top),
        bottom: Math.max(start.bottom, end.bottom),
        left: (start.left + end.left) / 2,
      });
    }
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  if (!sel) return null;
  const range = sel;

  function mark(ref: string) {
    markMade(editor, range.from, range.to, ref);
    editor.commands.setTextSelection(range.to);
    setSel(null);
    setAsking(null);
    setChoosing(false);
  }

  async function run(job: () => Promise<string>) {
    setBusy(true);
    try {
      mark(await job());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work; try again.");
    } finally {
      setBusy(false);
    }
  }

  function note(kind: NoteKind) {
    void run(async () => `note:${(await notesApi.create(storyId, { kind, content: range.text.trim() })).id}`);
  }

  function scene(choice: SceneChoice) {
    const file: FileChoice =
      choice.how === "idea"
        ? { kind: "idea" }
        : { kind: "scene", how: choice.how, title: choice.title, spot: choice.spot };
    void run(async () => {
      const made = await makeFrom(storyId, choice.how === "start" ? range.lines : range.text, file);
      toast.info(
        choice.how === "idea"
          ? "Kept as an idea in the Outline's Not placed yet tray."
          : `“${made.label}” is in the Outline, ${choice.how === "plan" ? "planned" : "with these words as its first draft"}.`,
      );
      return made.ref;
    });
  }

  function thing(kind: Thing, value?: string) {
    const short = words(range.text).length <= 4;
    const name = value ?? (short ? range.text.trim() : "");
    // Ask for a name when the words are a sentence, not a name; a scene always shows its title.
    if (value === undefined && (kind === "character" || kind === "place" || kind === "theme") && !short) {
      setAsking({ kind, value: "" });
      setMore(false);
      return;
    }
    const choice: FileChoice =
      kind === "character" || kind === "place"
        ? { kind, name }
        : kind === "theme"
          ? { kind, theme: name }
          : { kind: kind as "logline" | "premise" | "conflict" };
    void run(async () => (await makeFrom(storyId, range.text, choice)).ref);
  }

  if (choosing) {
    // Under the words when it fits, else over them, else at the top of the window.
    const room = window.innerHeight - sel.bottom - 16;
    const place =
      room >= CHOOSER_HEIGHT
        ? { top: sel.bottom + 8 }
        : sel.top - 16 >= CHOOSER_HEIGHT
          ? { bottom: window.innerHeight - sel.top + 8 }
          : { top: 8 };
    return createPortal(
      <div
        style={{ position: "fixed", left: Math.max(8, sel.left - 190), ...place }}
        className={styles.chooserAt}
      >
        <SceneChooser words={range.text} busy={busy} onMake={scene} onCancel={() => setChoosing(false)} />
      </div>,
      document.body,
    );
  }

  const style = { top: Math.max(8, sel.top - 52), left: Math.max(8, sel.left - 240) };
  return createPortal(
    <div
      className={styles.bar}
      style={style}
      role="toolbar"
      aria-label="Make it"
      onMouseDown={(e) => e.preventDefault()}
    >
      {asking ? (
        <form
          className={styles.ask}
          onSubmit={(e) => {
            e.preventDefault();
            if (asking.value.trim()) thing(asking.kind, asking.value.trim());
          }}
        >
          <input
            autoFocus
            className={styles.askInput}
            value={asking.value}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setAsking({ ...asking, value: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && setAsking(null)}
            placeholder={
              asking.kind === "character"
                ? "Their name"
                : asking.kind === "place"
                  ? "Its name"
                  : "The theme, in a word or two"
            }
            aria-label="Name"
          />
          <button type="submit" className={styles.barPrimary} disabled={busy || !asking.value.trim()}>
            Make it
          </button>
        </form>
      ) : (
        <>
          <span className={styles.barLabel}>Make it</span>
          {NOTE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={styles.barBtn}
              data-kind={k}
              disabled={busy}
              onClick={() => note(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
          <span className={styles.barRule} aria-hidden />
          <button type="button" className={styles.barBtn} disabled={busy} onClick={() => thing("character")}>
            Character
          </button>
          <button type="button" className={styles.barBtn} disabled={busy} onClick={() => thing("place")}>
            Place
          </button>
          <button type="button" className={styles.barBtn} disabled={busy} onClick={() => setChoosing(true)}>
            Scene
          </button>
          <div className={styles.moreWrap}>
            <button
              type="button"
              className={styles.barBtn}
              aria-haspopup="menu"
              aria-expanded={more}
              onClick={() => setMore((m) => !m)}
            >
              More <ChevronDown size={12} aria-hidden />
            </button>
            {more && (
              <div className={styles.moreMenu} role="menu">
                {MORE.map((m) => (
                  <button
                    key={m.kind}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => thing(m.kind)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
