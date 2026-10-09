import { useEffect, useRef, useState } from "react";
import type { StructureNode } from "../../types";
import { formatMinutes } from "../../lib/writingToday";
import { useHostFocusExit } from "../../lib/focusExit";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import FocusExit from "../layout/FocusExit";
import SprintTimer from "../story/SprintTimer";
import type { AutosaveState } from "./useSceneAutosave";
import { goalFor, ledFor, statusFigures } from "./statusFigures";
import { useTodayWords } from "./useTodayWords";
import styles from "./StatusCorner.module.css";

interface Props {
  node: StructureNode;
  autosave: AutosaveState;
  wordCount: number;
}

/**
 * The bottom right of the page (doc 24 D6): a save light (green saved, yellow unsaved or
 * saving, red offline or a conflict) and the scene's words. A click opens the figures for
 * the scene, its chapter, the book and today, and the goal; a conflict opens it by itself
 * with Keep mine and Take theirs. A running sprint shows beside it, and in focus mode so
 * does the way out, which GlobalLayout then leaves to it.
 */
export default function StatusCorner({ node, autosave, wordCount }: Props) {
  const { saveState, conflict } = autosave;
  const [open, setOpen] = useState(false);
  // A conflict opens the popover; closing it hides that conflict, not the next one.
  const [dismissed, setDismissed] = useState<StructureNode | null>(null);
  const shown = open || (saveState === "conflict" && !!conflict && dismissed !== conflict);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const structure = useStoryStore((s) => s.structure);
  const activeTemplate = useStoryStore((s) => s.activeTemplate);
  const intended = useStoryStore((s) => s.activeStory?.intended_length);
  const focused = useUIStore((s) => s.viewState === "focus");
  const sprintActive = useUIStore((s) => s.sprintActive);
  const today = useTodayWords(node.story_id, node.id, node.word_count ?? 0);
  useHostFocusExit();

  const { led, label } = ledFor(saveState);

  function close() {
    setOpen(false);
    setDismissed(conflict);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!shown) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setDismissed(conflict);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [shown, conflict]);

  const words = wordCount.toLocaleString();
  return (
    <div
      className={styles.corner}
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && shown) {
          e.stopPropagation();
          close();
        }
      }}
    >
      {sprintActive && <SprintTimer currentWordCount={wordCount} />}
      {focused && <FocusExit inline />}
      <button
        ref={trigger}
        type="button"
        className={`${styles.chip} ${shown ? styles.chipOpen : ""}`}
        title={label}
        aria-label={`${label}. ${words} words in this scene. Show the figures`}
        aria-haspopup="dialog"
        aria-expanded={shown}
        onClick={() => (shown ? close() : setOpen(true))}
      >
        <span className={`${styles.led} ${styles[led]}`} aria-hidden />
        <span className={styles.words}>{words} words</span>
      </button>
      {shown && (
        <Figures
          node={node}
          autosave={autosave}
          label={label}
          led={led}
          wordCount={wordCount}
          structure={structure}
          levelName={activeTemplate?.levels}
          goal={goalFor(intended)}
          today={today}
        />
      )}
      <span className={styles.srOnly} role="status">
        {saveState === "offline" || saveState === "conflict" ? label : ""}
      </span>
    </div>
  );
}

function Figures({
  node,
  autosave,
  label,
  led,
  wordCount,
  structure,
  levelName,
  goal,
  today,
}: {
  node: StructureNode;
  autosave: AutosaveState;
  label: string;
  led: string;
  wordCount: number;
  structure: StructureNode[];
  levelName: { name: string }[] | undefined;
  goal: number | null;
  today: ReturnType<typeof useTodayWords>;
}) {
  const f = statusFigures(structure, node.id, wordCount);
  const parentKind = f.parent ? (levelName?.[f.parent.node.level]?.name ?? f.parent.node.level_type) : "";
  const pct = goal ? Math.min(100, Math.round((f.book / goal) * 100)) : 0;
  return (
    <div className={styles.pop} role="dialog" aria-label="Words and saving">
      <div className={styles.saveLine}>
        <span className={`${styles.led} ${styles[led]}`} aria-hidden />
        <span>{label}</span>
      </div>
      {autosave.saveState === "conflict" && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={autosave.keepMine}
            title="Overwrite the saved copy with the text in this editor"
          >
            Keep mine
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={autosave.takeTheirs}
            title="Load the other version and drop these edits"
          >
            Take theirs
          </button>
        </div>
      )}
      <dl className={styles.grid}>
        <dt>This scene</dt>
        <dd>{f.scene.toLocaleString()}</dd>
        {f.parent && (
          <>
            <dt className={styles.ellipsis} title={f.parent.node.title}>
              This {parentKind.toLowerCase()}
            </dt>
            <dd>{f.parent.words.toLocaleString()}</dd>
          </>
        )}
        <dt>The book</dt>
        <dd>{f.book.toLocaleString()}</dd>
        {today && (
          <>
            <dt title={`${formatMinutes(today.seconds)} writing today, in this story`}>Today</dt>
            <dd className={styles.today}>
              {today.words >= 0 ? "+" : "−"}
              {Math.abs(today.words).toLocaleString()}
            </dd>
          </>
        )}
      </dl>
      {goal && (
        <div className={styles.goal}>
          <div className={styles.goalLine}>
            <span>Toward {goal.toLocaleString()}</span>
            <span>{pct}%</span>
          </div>
          <div className={styles.bar} aria-hidden>
            <div className={styles.barFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
