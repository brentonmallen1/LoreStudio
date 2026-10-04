import type { MentionDropdownState } from "./useMentionDropdown";
import { clampPopup } from "./segmentMeta";
import styles from "./SceneEditor.module.css";

const HEADING = { mention: null, place: "Place", speaker: "Who says it", line: "A line for" } as const;

/** The suggestions of whichever picker is open (useMentionDropdown); Enter or Tab takes one. */
export default function MentionDropdown({ mention }: { mention: MentionDropdownState }) {
  if (!mention.open || mention.choices.length === 0) return null;
  const heading = HEADING[mention.mode];
  return (
    <div
      className={styles.mentionDropdown}
      style={clampPopup(mention.pos.bottom, mention.pos.left, 260, 280)}
      role="listbox"
      aria-label={heading ?? "Mention"}
    >
      {heading && <div className={styles.mentionDropdownDialogueMode}>{heading}</div>}
      {mention.choices.map((c, idx) => (
        <button
          key={`${c.kind}:${c.name}:${c.words}:${c.create ? "new" : ""}`}
          role="option"
          aria-selected={idx === mention.selIdx}
          className={`${styles.mentionItem} ${idx === mention.selIdx ? styles.mentionItemSelected : ""} ${c.create ? styles.mentionItemCreate : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void mention.accept(c)}
        >
          {c.create ? (
            <span className={styles.mentionItemName}>
              + New {c.kind === "character" ? "character" : "place"} “{c.name}”
            </span>
          ) : (
            <>
              <span className={styles.mentionItemName}>
                {c.via ? (
                  <>
                    {c.via} <span className={styles.mentionItemVia}>→ {c.name}</span>
                  </>
                ) : (
                  c.name
                )}
              </span>
              {c.fromSeries ? (
                <span className={styles.mentionItemType}>from the series</span>
              ) : c.kind === "character" && c.role ? (
                <span className={styles.mentionItemRole}>{c.role}</span>
              ) : c.kind === "place" ? (
                <span className={styles.mentionItemType}>place</span>
              ) : null}
            </>
          )}
        </button>
      ))}
      <div className={styles.mentionDropdownKeys}>Tab or Enter to choose · Esc to close</div>
    </div>
  );
}
