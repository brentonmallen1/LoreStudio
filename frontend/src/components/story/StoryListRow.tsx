import { useState } from "react";
import { ArrowRight, BookPlus, Trash2 } from "lucide-react";
import type { StoryProgress } from "../../api/progress";
import { formatRelative } from "../../lib/utils";
import { bookLabel } from "../../stores/seriesStore";
import type { Story } from "../../types";
import styles from "./StoryList.module.css";

/**
 * A story as one row of the dashboard's list: the cards' facts on a line, for when there are
 * many. Its title, its words against the target, when it last changed, and the same Continue,
 * Write a sequel and Delete the card has.
 */
export default function StoryListRow({
  story,
  ordinal,
  progress,
  deleting,
  onOpen,
  onContinue,
  onSequel,
  onDelete,
}: {
  story: Story;
  /** Its place in its series, when it has one. */
  ordinal?: number;
  progress?: StoryProgress;
  deleting: boolean;
  onOpen: () => void;
  onContinue: () => void;
  onSequel: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const words = progress?.word_count ?? 0;
  return (
    <li className={styles.row}>
      <button type="button" className={styles.open} onClick={onOpen} aria-label={`Open ${story.title}`}>
        <span className={styles.name}>
          {ordinal !== undefined && <span className={styles.ordinal}>{bookLabel(ordinal)}</span>}
          <span className={styles.title}>{story.title}</span>
        </span>
        {story.description && <span className={styles.desc}>{story.description}</span>}
      </button>
      <span className={styles.words}>
        {words > 0 && progress?.target_words ? (
          <>
            <span className={styles.track} aria-hidden>
              <span style={{ width: `${Math.min(100, progress.pct ?? 0)}%` }} />
            </span>
            {words.toLocaleString()} of {progress.target_words.toLocaleString()}
          </>
        ) : words > 0 ? (
          `${words.toLocaleString()} words`
        ) : (
          <span className={styles.none}>No words yet</span>
        )}
      </span>
      <span className={styles.when}>{formatRelative(story.updated_at)}</span>
      <span className={styles.actions}>
        {confirming ? (
          <>
            <button
              type="button"
              className={styles.yes}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete
            </button>
            <button type="button" className={styles.no} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {progress?.last_scene_id && (
              <button
                type="button"
                className={styles.continue}
                onClick={onContinue}
                title={`Continue writing “${progress.last_scene_title}”`}
              >
                Continue <ArrowRight size={12} aria-hidden />
              </button>
            )}
            <button
              type="button"
              className={styles.icon}
              onClick={onSequel}
              title="Write a sequel"
              aria-label={`Write a sequel to ${story.title}`}
            >
              <BookPlus size={14} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.icon}
              data-danger
              disabled={deleting}
              onClick={() => setConfirming(true)}
              title="Delete"
              aria-label={`Delete ${story.title}`}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </>
        )}
      </span>
    </li>
  );
}
