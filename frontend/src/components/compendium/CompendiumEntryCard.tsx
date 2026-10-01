import { FileText, Link, File, Paperclip, Pencil, Trash2 } from "lucide-react";
import type { CompendiumEntrySummary } from "../../types";
import styles from "./CompendiumPanel.module.css";

interface Props {
  entry: CompendiumEntrySummary;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isPendingDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}

function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CompendiumEntryCard({
  entry,
  onClick,
  onEdit,
  onDelete,
  isPendingDelete,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const Icon = entry.entry_type === "note" ? FileText : entry.entry_type === "url" ? Link : File;
  const sub =
    entry.entry_type === "url" && entry.url
      ? entry.url_title && entry.url_title !== entry.title
        ? entry.url_title
        : urlDomain(entry.url)
      : entry.preview;

  // A row like the Compendium's index (doc 13 P7): the same entries looked like other
  // objects as cards on one page and rows on the next.
  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={onClick}>
        <span className={styles.rowIcon} aria-hidden>
          <Icon size={15} />
        </span>
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{entry.title}</span>
          {sub && <span className={styles.rowPreview}>{sub}</span>}
        </span>
        <span className={styles.rowMeta}>
          {entry.tags.length > 0 && <span>{entry.tags.slice(0, 3).join(", ")}</span>}
          {entry.attachment_count > 0 && (
            <span className={styles.attachBadge}>
              <Paperclip size={11} aria-hidden />
              {entry.attachment_count}
            </span>
          )}
        </span>
      </button>
      <div className={styles.cardActions}>
        {isPendingDelete ? (
          <div className={styles.deleteConfirm}>
            <button className={styles.deleteConfirmYes} onClick={onConfirmDelete}>
              Delete
            </button>
            <button className={styles.deleteConfirmNo} onClick={() => onCancelDelete?.()}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              className={styles.actionBtn}
              onClick={onEdit}
              title="Edit"
              aria-label={`Edit ${entry.title}`}
            >
              <Pencil size={13} />
            </button>
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={onDelete}
              title="Delete"
              aria-label={`Delete ${entry.title}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
