import type { StoryFormat, WorkingStyle } from "../../types";
import { FORMATS } from "../../lib/storyFormat";
import { NO_RIGHT_ANSWER, WORKING_STYLES } from "../../lib/workingStyle";
import styles from "./CreateStoryDialog.module.css";

/** What New Story calls each format (doc 29 P1): what the writer is making, in their words. */
const WRITING_WORDS: Record<StoryFormat, string> = {
  prose: "A novel or story",
  screenplay: "A screenplay",
  stage_play: "A stage play",
};

/** "What are you writing?": one pill per format, the chosen one's hint under them. */
export function WhatYouWrite({
  format,
  onChange,
}: {
  format: StoryFormat;
  onChange: (f: StoryFormat) => void;
}) {
  const chosen = FORMATS.find((f) => f.id === format);
  return (
    <fieldset className={styles.begin}>
      <legend className={styles.question}>What are you writing?</legend>
      <div className={styles.pills}>
        {FORMATS.map((f) => (
          <label key={f.id} className={`${styles.pill} ${format === f.id ? styles.pillOn : ""}`}>
            <input
              type="radio"
              name="format"
              value={f.id}
              checked={format === f.id}
              onChange={() => onChange(f.id)}
              className={styles.pillInput}
            />
            {WRITING_WORDS[f.id]}
          </label>
        ))}
      </div>
      {chosen && <span className={styles.questionHint}>{chosen.hint}</span>}
    </fieldset>
  );
}

/**
 * "How do you like to work?" (doc 29 D1): three ways, none of them right, and the First story
 * guide offered as one line under them for a new writer of prose.
 */
export function HowYouWork({
  style,
  onChange,
  offerFirstStory,
  firstStory,
  onFirstStory,
}: {
  style: WorkingStyle;
  onChange: (s: WorkingStyle) => void;
  offerFirstStory: boolean;
  firstStory: boolean;
  onFirstStory: (on: boolean) => void;
}) {
  return (
    <fieldset className={styles.begin}>
      <legend className={styles.question}>How do you like to work?</legend>
      <span className={styles.questionHint}>{NO_RIGHT_ANSWER}</span>
      {WORKING_STYLES.map((w) => (
        <label key={w.id} className={`${styles.beginOption} ${style === w.id ? styles.beginChosen : ""}`}>
          <input
            type="radio"
            name="working-style"
            value={w.id}
            checked={style === w.id}
            onChange={() => onChange(w.id)}
          />
          <span>
            <span className={styles.beginName}>{w.label}</span>
            <span className={styles.beginHint}>{w.hint}</span>
          </span>
        </label>
      ))}
      {offerFirstStory && (
        <div className={styles.firstStory}>
          <span className={styles.firstStoryText}>
            <strong>First story?</strong>{" "}
            {firstStory
              ? "You'll start with the First story guide: seven steps from an idea to a first scene."
              : "Seven guided steps take you from an idea to a first scene."}
          </span>
          <button
            type="button"
            className={styles.secondaryBtn}
            aria-pressed={firstStory}
            onClick={() => onFirstStory(!firstStory)}
          >
            {firstStory ? "Don't use the guide" : "Use My first story"}
          </button>
        </div>
      )}
    </fieldset>
  );
}
