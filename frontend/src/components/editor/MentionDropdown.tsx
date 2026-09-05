import type { MentionDropdownState } from "./useMentionDropdown";
import { clampPopup } from "./segmentMeta";
import styles from "./SceneEditor.module.css";

export default function MentionDropdown({ mention }: { mention: MentionDropdownState }) {
  if (!mention.open || mention.filteredItems.length === 0) return null;
  return (
    <div
      className={styles.mentionDropdown}
      style={clampPopup(mention.pos.bottom, mention.pos.left, 260, 260)}
    >
      {mention.dialogueMode && <div className={styles.mentionDropdownDialogueMode}>Dialogue speaker</div>}
      {mention.attributionMode && <div className={styles.mentionDropdownDialogueMode}>Attribute to</div>}
      {mention.filteredItems.map((item, idx) => (
        <button
          key={`${item.type}:${item.name}`}
          className={`${styles.mentionItem} ${idx === mention.selIdx ? styles.mentionItemSelected : ""} ${item.type === "create" ? styles.mentionItemCreate : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => mention.insert(item)}
        >
          {item.type === "create" ? (
            <span className={styles.mentionItemName}>+ Create "{item.name}"</span>
          ) : (
            <>
              <span className={styles.mentionItemName}>{item.name}</span>
              {item.type === "character" && item.role ? (
                <span className={styles.mentionItemRole}>{item.role}</span>
              ) : item.type === "setting" ? (
                <span className={styles.mentionItemType}>setting</span>
              ) : null}
            </>
          )}
        </button>
      ))}
    </div>
  );
}
