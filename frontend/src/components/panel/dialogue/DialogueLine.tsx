import { Check, Orbit, X } from "lucide-react";
import { slotVar } from "../../../lib/colorSlots";
import type { PlacedLine } from "../../../lib/dialogue/sides";
import type { SpeakerChoices } from "../../../lib/dialogue/speakerChoices";
import type { Character, DialogueBlock, ProposedDialogueTag } from "../../../types";
import SpeakerPicker from "./SpeakerPicker";
import styles from "./Dialogue.module.css";

interface Props {
  block: DialogueBlock;
  placed: PlacedLine;
  unattributed: boolean;
  /** Spoken by the point-of-view character in a first-person story: named "I". */
  isPov: boolean;
  speaker: Character | undefined;
  choices: SpeakerChoices;
  tagging: boolean;
  onTag: (name: string) => Promise<boolean>;
  /** The Assistant's guess for an untagged line, when asked for (Studio). */
  suggestion?: ProposedDialogueTag;
  onDismiss: (suggestionId: string) => void;
}

/**
 * One line in the Dialogue thread (doc 24 D8, D17). The name heads a run only; a line's own
 * marks (a thought, a guessed speaker's "?") stay on it. A line with no speaker sits in the
 * middle with "Who says this?", which opens the cast and tags the line.
 */
export default function DialogueLine({
  block,
  placed,
  unattributed,
  isPov,
  speaker,
  choices,
  tagging,
  onTag,
  suggestion,
  onDismiss,
}: Props) {
  const { side, runStart } = placed;
  const thought = block.dialogue_type === "thought";
  const guessed = block.attribution_method === "inferred" || block.attribution_method === "alternating";
  const align = side === "right" ? "end" : "start";
  const text = thought ? <em>{block.content}</em> : `“${block.content}”`;

  if (unattributed) {
    return (
      <div className={`${styles.line} ${styles.centre}`}>
        <div className={`${styles.bubble} ${styles.bubbleOpen} ${thought ? styles.thought : ""}`}>{text}</div>
        {thought ? (
          // A thought has no speaker tag in the prose's grammar, so there is nothing to choose:
          // it is the point-of-view character's in a first-person story, and unmarked otherwise.
          <div className={styles.noSpeaker}>A thought</div>
        ) : (
          <div className={styles.noSpeaker}>
            No speaker yet ·{" "}
            <SpeakerPicker
              label="No speaker yet: choose who says this line"
              trigger={<span className={styles.pick}>Who says this?</span>}
              choices={choices}
              align="start"
              disabled={tagging}
              onPick={(c) => onTag(c.name)}
            />
          </div>
        )}
        {suggestion?.inferred_speaker && (
          <div className={styles.suggestion}>
            <Orbit size={12} aria-hidden className={styles.suggestionIcon} />
            <span className={styles.suggestionName}>{suggestion.inferred_speaker}</span>
            {suggestion.source_excerpt && (
              <span className={styles.suggestionWhy} title={suggestion.source_excerpt}>
                {suggestion.source_excerpt}
              </span>
            )}
            <button
              type="button"
              className={styles.suggestionBtn}
              aria-label={`Tag this line as ${suggestion.inferred_speaker}`}
              title="Tag it"
              disabled={tagging}
              onClick={async () => {
                if (await onTag(suggestion.inferred_speaker!)) onDismiss(suggestion.id);
              }}
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className={styles.suggestionBtn}
              aria-label="Dismiss this suggestion"
              title="Dismiss"
              onClick={() => onDismiss(suggestion.id)}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }

  const mark = thought ? (
    <span className={styles.thoughtMark}>thought</span>
  ) : isPov ? (
    block.attribution_method === "pov_default" && <span className={styles.guess}>pov</span>
  ) : (
    guessed && (
      <SpeakerPicker
        label={`${block.speaker_name} is a guess: choose who says this line`}
        trigger={<span className={styles.guess}>?</span>}
        choices={choices}
        align={align}
        disabled={tagging}
        onPick={(c) => onTag(c.name)}
      />
    )
  );

  return (
    <div
      className={`${styles.line} ${side === "right" ? styles.right : styles.left} ${runStart ? "" : styles.cont}`}
    >
      {(runStart || mark) && (
        <div className={styles.who}>
          {runStart && (
            <>
              <span className={styles.dot} style={{ background: slotVar(speaker?.color_slot) }} aria-hidden />
              <span className={styles.name}>{isPov ? "I" : block.speaker_name}</span>
            </>
          )}
          {mark}
        </div>
      )}
      <div className={`${styles.bubble} ${thought ? styles.thought : ""}`}>{text}</div>
    </div>
  );
}
