import { useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Compass } from "lucide-react";
import type { Character } from "../../types";
import SnowflakeGuidance from "./SnowflakeGuidance";
import styles from "./SnowflakeLayerEditor.module.css";

// Layer metadata for UI hints
const LAYER_META: Record<string, { goal: string; placeholder: string; prevLabel?: string }> = {
  sentence: {
    goal: "~25 words. No character names — use roles. Hint at conflict and what makes the story unique.",
    placeholder: "A lighthouse keeper on a remote island discovers something unexpected when a stranger arrives during a storm.",
  },
  paragraph: {
    goal: "Five sentences: (1) protagonist in their world, (2) first disaster, (3) second disaster, (4) third disaster, (5) how it ends.",
    placeholder: "Elias has kept the lighthouse for twenty years, alone by choice…",
  },
  character_summary: {
    goal: "Goal, motivation, central conflict, and epiphany — what does this character want, why, what stops them, what do they learn?",
    placeholder: "Goal: to uncover the truth about the night the ship went down…",
    prevLabel: "Story paragraph",
  },
  synopsis: {
    goal: "Expand each sentence of your paragraph into a full paragraph. Five paragraphs, full arc.",
    placeholder: "Elias Holt has tended the Last Lighthouse alone since his wife vanished…",
    prevLabel: "Paragraph summary",
  },
  character_synopsis: {
    goal: "Tell this character's full story in first person (I). Their truth as they lived it — where they began emotionally, what happened, where they ended.",
    placeholder: "I have kept the light burning every night for twenty years, because that was the promise I made…",
    prevLabel: "Character summary",
  },
};

interface Props {
  storyId: string;
  layer: string;
  value: string;
  prevContent?: string;
  character?: Character | null;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function SnowflakeLayerEditor({ storyId, layer, value, prevContent, character, onSave, onClose }: Props) {
  const [text, setText] = useState(value);
  const [showGuidance, setShowGuidance] = useState(false);
  const [prevExpanded, setPrevExpanded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meta = LAYER_META[layer] ?? { goal: "", placeholder: "" };

  const scheduleAutoSave = useCallback((val: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(val), 600);
  }, [onSave]);

  function handleChange(val: string) {
    setText(val);
    scheduleAutoSave(val);
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className={styles.editor}>
      {/* Prev layer reference */}
      {prevContent && meta.prevLabel && (
        <div className={styles.prevWrap}>
          <button
            className={styles.prevToggle}
            onClick={() => setPrevExpanded((e) => !e)}
          >
            {prevExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>{meta.prevLabel}</span>
          </button>
          {prevExpanded && (
            <div className={styles.prevContent}>{prevContent}</div>
          )}
        </div>
      )}

      {/* Goal hint */}
      <p className={styles.goalHint}>{meta.goal}</p>

      {/* Text area */}
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={meta.placeholder}
        rows={layer === "character_synopsis" || layer === "synopsis" ? 12 : 5}
      />

      <div className={styles.footer}>
        <span className={styles.wordCount}>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
        <div className={styles.footerActions}>
          <button
            className={styles.guidanceBtn}
            onClick={() => setShowGuidance((v) => !v)}
            title="Get AI guidance"
          >
            <Compass size={13} />
            {showGuidance ? "Hide guidance" : "Get guidance"}
          </button>
          <button className={styles.doneBtn} onClick={() => { onSave(text); onClose(); }}>
            Done
          </button>
        </div>
      </div>

      {showGuidance && (
        <SnowflakeGuidance
          storyId={storyId}
          layer={layer}
          content={text}
          characterId={character?.id ?? null}
          onClose={() => setShowGuidance(false)}
        />
      )}
    </div>
  );
}

// ── Character selector for layers 3 and 5 ─────────────────────────────────────

interface CharSelectorProps {
  characters: Character[];
  selectedId: string | null;
  onChange: (id: string) => void;
}

export function CharacterLayerSelector({ characters, selectedId, onChange }: CharSelectorProps) {
  return (
    <div className={styles.charSelector}>
      <p className={styles.charSelectorLabel}>Select character</p>
      <div className={styles.charList}>
        {characters.map((c) => (
          <button
            key={c.id}
            className={`${styles.charBtn} ${c.id === selectedId ? styles.charBtnActive : ""}`}
            onClick={() => onChange(c.id)}
          >
            <span className={styles.charRole}>{c.role}</span>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
